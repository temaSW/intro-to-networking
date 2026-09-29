"""Behavior checks for the browser's actual JavaScript numerical model.

These functions are pytest tests and can also be invoked directly when pytest
is not installed. Node 18+ is required; no npm packages are needed.
"""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "course" / "interactives" / "impulse-ask-model.js"


def run_js(assertions: str) -> None:
    script = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync({str(MODEL)!r}, 'utf8');
const m = await import('data:text/javascript,' + encodeURIComponent(source));
{assertions}
"""
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert completed.returncode == 0, completed.stderr


def test_bit_waveform_duration_and_levels():
    run_js("""
const wave = m.bitWaveform('1010', 10, 1);
assert.equal(wave[0], 1);
const samplesPerBit = m.SAMPLE_RATE_KHZ / 10;
assert.equal(wave[samplesPerBit - 1], 1);
assert.equal(wave[samplesPerBit], 0);
assert.equal(wave[2 * samplesPerBit], 1);
assert.equal(wave[4 * samplesPerBit], 0);
assert([...wave].every(v => v === 0 || v === 1));
""")


def test_ook_is_zero_on_zero_bits():
    run_js("""
const base = m.bitWaveform('1010', 10);
const ask = m.ook(base, 100);
for (let i = 0; i < base.length; i++) if (base[i] === 0) assert.equal(ask[i], 0);
""")


def test_carrier_moves_spectral_peak():
    run_js("""
function peak(signal) {
  const spec = m.spectrum(signal);
  const i = spec.magnitude.indexOf(Math.max(...spec.magnitude));
  return i * spec.stepKhz;
}
const p1 = peak(m.carrier(80));
const p2 = peak(m.carrier(140));
assert(Math.abs(p1 - 80) < .5);
assert(Math.abs(p2 - 140) < .5);
""")


def test_bandpass_rejects_out_of_band_tone():
    run_js("""
const inside = m.carrier(100), outside = m.carrier(160);
const mixed = m.addSignals(inside, outside);
const filtered = m.spectrum(m.bandpass(mixed, 100, 20));
const at = f => filtered.magnitude[Math.round(f / filtered.stepKhz)];
assert(at(100) > .5);
assert(at(160) < .001);
""")


def test_ui_sampling_range_and_two_users():
    run_js("""
assert(m.validateSampling(m.MAX_CARRIER_KHZ, m.MAX_BIT_RATE_KBPS));
assert(m.MAX_CARRIER_KHZ + 4 * m.MAX_BIT_RATE_KBPS <= m.SAMPLE_RATE_KHZ / 10);
const a = m.ook(m.bitWaveform('1010', 10), 100);
const b = m.ook(m.bitWaveform('0101', 10), 140);
const sum = m.addSignals(a, b);
for (let i = 0; i < sum.length; i++) assert(Math.abs(sum[i] - a[i] - b[i]) < 1e-12);
""")


def test_component_import_smoke():
    script = "globalThis.document = {querySelectorAll: () => []}; await import('./course/interactives/impulse-ask-ui.js');"
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert completed.returncode == 0, completed.stderr
    page = (ROOT / "course" / "practice" / "impulse-to-carrier.qmd").read_text(encoding="utf-8")
    assert 'data-impulse-ask' in page
    assert 'impulse-ask-ui.js' in page


def test_practice_fourier_and_averaged_spectra():
    run_js("""
const one = m.squareFourier(1);
const many = m.squareFourier(19);
assert.equal(one.lines.length, 1);
assert.equal(many.lines.length, 10);
assert.deepEqual(many.lines.slice(0, 3).map(v => v.frequencyKhz), [2, 6, 10]);
const bipolar = m.periodicPulseFourier(19, -1, .5);
const quarter = m.periodicPulseFourier(19, 0, .25);
const threeQuarters = m.periodicPulseFourier(19, 0, .75);
assert.equal(bipolar.dc, 0);
assert.equal(quarter.dc, .25);
assert.equal(threeQuarters.dc, .75);
assert(Math.abs(bipolar.lines[2].amplitude) < 1e-12);
assert(Math.abs(quarter.lines[4].amplitude) < 1e-12);
assert(Math.abs(quarter.lines[1].amplitude - threeQuarters.lines[1].amplitude) < 1e-12);
const signals = m.practiceSignals(10);
assert.deepEqual(signals.bits.slice(0, 5), [1, 0, 1, 1, 0]);
const ask = m.averagedPowerSpectrum(signals.ask);
const fsk = m.averagedPowerSpectrum(signals.fsk);
const psk = m.averagedPowerSpectrum(signals.psk);
assert.equal(ask.windows, 15);
assert.equal(ask.stepKhz, m.SAMPLE_RATE_KHZ / m.PRACTICE_FFT_SIZE);
assert(m.SAMPLE_RATE_KHZ >= 10 * (m.PRACTICE_CARRIER_KHZ + m.PRACTICE_FSK_SHIFT_KHZ + 4 * 25));
assert.equal(m.squareFourier(19).time[1], 1 / 800);
assert(1 / (many.time[1] - many.time[0]) >= 10 * 38);
const at = (s, f) => s.power[Math.round(f / s.stepKhz)];
assert(at(ask, 100) > at(ask, 82) * 5);
assert(at(fsk, 82) > at(fsk, 100) * 2);
assert(at(fsk, 118) > at(fsk, 100) * 2);
assert(at(ask, 100) > at(psk, 100) * 5);
""")


def test_translation_and_filter_boundaries():
    run_js("""
const at70 = m.translatedToneSpectrum(70, 80);
assert.deepEqual(at70.translated.map(line => line.frequencyKhz), [50, 58, 65, 75, 82, 90]);
assert.deepEqual(at70.passed.map(line => line.frequencyKhz), [50, 58, 65, 75]);
assert.deepEqual(at70.rejected.map(line => line.frequencyKhz), [82, 90]);
assert.equal(at70.translated.find(line => line.frequencyKhz === 65).amplitude, .5);
assert.deepEqual(at70.recovered.map(line => line.amplitude), [1, .35, .225]);
const at90 = m.translatedToneSpectrum(90, 80);
assert.deepEqual(at90.passed.map(line => line.frequencyKhz), [70, 78]);
assert.deepEqual(at90.recovered.map(line => line.amplitude), [0, .35, .225]);
const allPassed = m.translatedToneSpectrum(70, 90);
assert.deepEqual(allPassed.passed.map(line => line.frequencyKhz), [50, 58, 65, 75, 82, 90]);
assert.deepEqual(allPassed.recovered.map(line => line.amplitude), [1, .7, .45]);
assert.equal(at70.timeMs.length, 641);
for (const i of [0, 71, 320, 640]) {
  const carrier = Math.cos(2 * Math.PI * 70 * at70.timeMs[i]);
  assert(Math.abs(at70.translatedTime[i] - at70.basebandTime[i] * carrier) < 1e-12);
  const rejected = at70.rejected.reduce((sum, line) =>
    sum + line.amplitude * Math.cos(2 * Math.PI * line.frequencyKhz * at70.timeMs[i]), 0);
  assert(Math.abs(at70.translatedTime[i] - at70.passedTime[i] - rejected) < 1e-12);
  const high = at70.passed.reduce((sum, line) => sum +
    line.amplitude * Math.cos(2 * Math.PI * (line.frequencyKhz + 70) * at70.timeMs[i]), 0);
  assert(Math.abs(2 * at70.passedTime[i] * carrier - at70.recoveredTime[i] - high) < 1e-12);
  assert(Math.abs(allPassed.recoveredTime[i] - allPassed.basebandTime[i]) < 1e-12);
}
""")
