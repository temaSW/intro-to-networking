"""Physical-model checks; optional real-codec tests run in the offline environment."""
from pathlib import Path
import hashlib
import json
import math
import subprocess
import sys
import pytest

np = pytest.importorskip("numpy")
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "interactives/audio-channel-coding"))
sys.path.insert(0, str(ROOT / "scripts"))
import model as m


def test_noise_power_definitions():
    assert m.digital_variance(0) == .5
    assert m.digital_variance(10) == pytest.approx(.05)
    assert m.analog_variance(np.array([1, -1]), 10) == pytest.approx(.1)
    assert m.analog_variance(np.zeros(4), 0) == 0
    noise = m.channel(np.zeros(200000), .5)
    assert np.var(noise) == pytest.approx(.5, rel=.015)


def test_pcm_bits_round_trip_exhaustive():
    values = np.arange(256, dtype=np.uint8)
    assert np.array_equal(values, m.bits_to_pcm(m.pcm_to_bits(values)))
    assert np.array_equal(values, m.pcm_encode(m.pcm_decode(values)))
    assert m.pcm_to_bits(np.array([128], dtype=np.uint8)).tolist() == [1, 0, 0, 0, 0, 0, 0, 0]
    with pytest.raises(ValueError):
        m.bits_to_pcm([1, 0, 1])


def test_pcm_quantization_bound():
    original = m.synthesize()
    recovered = m.pcm_decode(m.pcm_encode(original))
    assert np.max(np.abs(original - recovered)) <= 1 / 255 + 1e-7


def test_bpsk_mapping_and_high_snr():
    bits = np.array([0, 1, 1, 0], dtype=np.uint8)
    assert m.bpsk(bits).tolist() == [1, -1, -1, 1]
    assert np.array_equal(m.hard_decision(m.channel(m.bpsk(bits), 0)), bits)
    payload = m.pcm_to_bits(m.pcm_encode(m.synthesize()))
    recovered, metrics = m.transmit(payload, 30)
    assert np.array_equal(payload, recovered)
    assert metrics["post_ber"] == metrics["fer"] == 0
    assert metrics["rate"] == metrics["overhead"] == 1


def test_uncoded_ber_at_zero_db():
    payload = m.pcm_to_bits(m.pcm_encode(m.synthesize()))
    _, metrics = m.transmit(payload, 0)
    theory = .5 * math.erfc(1)  # Q(sqrt(2*Es/N0))
    assert metrics["post_ber"] == pytest.approx(theory, abs=.002)
    assert .06 < metrics["channel_ber"] < .10


def test_seed_reproducibility():
    source = m.synthesize()
    assert np.array_equal(source, m.synthesize())
    a = m.channel(source, .4, seed=17)
    assert np.array_equal(a, m.channel(source, .4, seed=17))
    assert not np.array_equal(a, m.channel(source, .4, seed=18))
    assert np.array_equal(m.channel(source, 0), source)


def test_sinusoid_loop_and_source_length():
    source = m.synthesize()
    assert source.shape == (32768,)
    assert np.max(np.abs(source)) == pytest.approx(.85)
    assert abs(source[0]) < 1e-10 and abs(source[-1]) < 1e-10
    assert abs(source[1] - source[-2]) < 1e-5


def test_frame_errors_and_code_rate():
    truth = np.zeros((3, 4), dtype=np.uint8)
    received = truth.copy()
    received[1, :2] = 1
    metrics = m.errors(truth, received)
    assert metrics["ber"] == 2 / 12
    assert metrics["fer"] == 1 / 3
    assert m.CodeParameters().rate == 1 / 3


@pytest.fixture(scope="module")
def codec():
    pytest.importorskip("sionna")
    return m.LDPC()


def test_ldpc_round_trip_and_rate(codec):
    frames = np.random.default_rng(7).integers(0, 2, (4, 2048), dtype=np.uint8)
    encoded = codec.encode(frames)
    assert encoded.shape == (4, 6144)
    assert codec.encoder.coderate == pytest.approx(1 / 3)
    received = m.channel(m.bpsk(encoded), m.digital_variance(20))
    assert np.array_equal(codec.decode(received, m.digital_variance(20)), frames)


def test_ldpc_improvement_and_cliff(codec):
    bits = np.random.default_rng(17).integers(0, 2, 32 * 2048, dtype=np.uint8)
    _, uncoded = m.transmit(bits, 0)
    _, coded = m.transmit(bits, 0, codec)
    assert coded["post_ber"] <= 1e-4
    assert coded["fer"] <= .03
    assert coded["post_ber"] < uncoded["post_ber"] / 100
    assert coded["overhead"] == 3
    _, failed = m.transmit(bits, -6, codec)
    assert failed["fer"] > .8
    assert failed["post_ber"] > .05


def test_generation_manifest_and_repeatability(codec, tmp_path):
    from generate_audio_channel_demo import generate
    p = m.CodeParameters(1024, 3072, 20)
    first = generate(tmp_path / "first", snrs=[0], parameters=p)
    second = generate(tmp_path / "second", snrs=[0], parameters=p)
    assert first == second
    assert first["code"]["rate"] == 1 / 3
    assert first["points"][0]["ldpc"]["post_ber"] <= 1e-4
    for name, file in first["files"].items():
        data = (tmp_path / "first" / file["file"]).read_bytes()
        assert len(data) == 2 * first["samples"]
        assert data == (tmp_path / "second" / file["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == file["sha256"]


def test_shipped_assets_match_manifest():
    directory = ROOT / "course/assets/audio-channel-coding"
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    for mode, file in manifest["files"].items():
        data = (directory / file["file"]).read_bytes()
        count = 1 if mode == "source" else len(manifest["points"])
        assert len(data) == file["bytes"] == count * manifest["samples"] * 2
        assert hashlib.sha256(data).hexdigest() == file["sha256"]
        samples = np.frombuffer(data, dtype="<i2")
        assert np.max(np.abs(samples.astype(np.int32))) < 32767
    point = next(p for p in manifest["points"] if p["snr_db"] == 0)
    assert .06 < point["digital"]["post_ber"] < .1
    assert point["ldpc"]["post_ber"] <= 1e-4
    assert point["ldpc"]["fer"] <= .03
    # A correctly decoded bit stream must leave exactly the original PCM quantization.
    raw_source = np.frombuffer((directory / "source.pcm").read_bytes(), dtype="<i2") / 32767 / manifest["playback_gain"]
    ldpc = np.frombuffer((directory / "ldpc.pcm").read_bytes(), dtype="<i2").reshape(len(manifest["points"]), -1)
    index = manifest["points"].index(point)
    recovered = ldpc[index] / 32767 / manifest["playback_gain"]
    assert np.max(np.abs(recovered - raw_source)) < .0041


def test_browser_pack_phase_and_waveform_helpers():
    path = ROOT / "course/interactives/audio-channel-coding/model.js"
    script = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(path)!r}, 'utf8')));
const bytes = new ArrayBuffer(8); const v = new DataView(bytes);
[0, 32767, -32768, 123].forEach((x,i) => v.setInt16(i*2,x,true));
const pack = m.decodePack(bytes,2,2);
assert.equal(pack[0][1],32767/32768); assert.equal(pack[1][0],-1);
assert.throws(() => m.decodePack(bytes,3,2));
assert.equal(m.loopPhase(1,10,13.5,4),.5);
assert.equal(m.nearestPoint([{{snr_db:-1}},{{snr_db:0}},{{snr_db:1}}],.2),1);
assert.deepEqual(m.envelope(new Float32Array([1,-1,.5,-.5]),2),[[-1,1],[-.5,.5]]);
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
