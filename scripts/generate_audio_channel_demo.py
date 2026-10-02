"""Generate static PCM16 packs and a manifest; no codec needed at site build."""
import argparse
from dataclasses import asdict
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "interactives/audio-channel-coding"))
from model import (CodeParameters, LDPC, SAMPLE_RATE, SEED, analog_variance,
                   bits_to_pcm, channel, pcm_decode, pcm_encode, pcm_to_bits, synthesize, transmit)


def read_source(path):
    with wave.open(str(path), "rb") as f:
        if f.getnchannels() != 1 or f.getsampwidth() != 2:
            raise ValueError("Source must be mono PCM16 WAV")
        rate = f.getframerate()
        source = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float32) / 32768
    if len(source) < 8 or not np.max(np.abs(source)):
        raise ValueError("Source must contain a nonempty, non-silent fragment")
    return source * (.85 / np.max(np.abs(source))), rate


def generate(output, source=None, snrs=None, parameters=CodeParameters()):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    original, rate = read_source(source) if source else (synthesize(), SAMPLE_RATE)
    snrs = list(range(-6, 11)) if snrs is None else list(snrs)
    bits = pcm_to_bits(pcm_encode(original))
    codec = LDPC(parameters)
    audio = {mode: [] for mode in ["analog", "digital", "ldpc"]}
    points = []
    for snr in snrs:
        audio["analog"].append(channel(original, analog_variance(original, snr), SEED))
        point = {"snr_db": snr, "analog": {"noise_variance": analog_variance(original, snr)}}
        for mode, coding in [("digital", None), ("ldpc", codec)]:
            decoded, metrics = transmit(bits, snr, coding, SEED + 1)
            audio[mode].append(pcm_decode(bits_to_pcm(decoded)))
            point[mode] = metrics
        points.append(point)
        print(f"SNR={snr:g}: uncoded BER={point['digital']['post_ber']:.5g}, LDPC BER={point['ldpc']['post_ber']:.5g}, FER={point['ldpc']['fer']:.5g}", flush=True)
    # One fixed gain for every mode/SNR. Preserve all analog noise without clipping.
    peak = max(float(np.max(np.abs(a))) for arr in audio.values() for a in arr)
    gain = min(.7, .95 / peak)
    files = {}
    for mode, arrays in {"source": [original], **audio}.items():
        data = np.rint(np.concatenate(arrays) * gain * 32767).astype("<i2").tobytes()
        filename = f"{mode}.pcm"
        (output / filename).write_bytes(data)
        files[mode] = {"file": filename, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    manifest = {"version": 1, "sample_rate": rate, "samples": len(original),
                "duration": len(original) / rate, "seed": SEED, "storage": "signed PCM16 little-endian",
                "playback_gain": gain, "pcm": "unsigned uniform 8-bit, MSB first, endpoints [-1,+1]",
                "snr": {"digital": "Es/N0; BPSK Es=1, real noise variance=1/(2*10^(SNR/10))",
                        "analog": "audio power / noise variance; not an equal-resource system comparison"},
                "code": {"name": "Sionna LDPC5GEncoder / LDPC5GDecoder", **asdict(parameters),
                         "rate": parameters.rate, "cn_update": "boxplus-phi", "llr": "log(P(1)/P(0))=-2*y/variance"},
                "source": {"kind": "local WAV" if source else "eight windowed three-sine chords",
                           "frequencies_hz": [261.6256,329.6276,391.9954,523.2511,440,391.9954,329.6276,293.6648],
                           "ratios": [1,1.25,1.5], "amplitudes": [1,.45,.3]},
                "versions": {name: importlib.metadata.version(name) for name in ["numpy", "torch", "sionna-no-rt"]},
                "files": files, "points": points}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument("--source", type=Path, help="Optional replacement mono PCM16 WAV")
    parser.add_argument("--output", type=Path, default=ROOT / "course/assets/audio-channel-coding")
    args = parser.parse_args()
    generate(args.output, args.source)


if __name__ == "__main__":
    main()
