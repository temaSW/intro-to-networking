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


def test_practice_variants_cover_translation_outcomes():
    run_js("""
const variants = m.PRACTICE_VARIANTS;
assert.equal(variants.length, 8);
assert.deepEqual(variants.map(({low,duty,rate1,rate2,channelBand,carrier,cutoff}) =>
  [low,duty,rate1,rate2,channelBand,carrier,cutoff]), [
  [-1,.5,5,15,12,55,75], [0,.25,10,20,16,70,70],
  [-1,.25,5,20,15,80,85], [0,.75,10,25,22,65,80],
  [-1,.75,15,25,18,90,80], [0,.5,5,25,20,75,60],
  [-1,.5,10,15,13,100,95], [0,.25,5,10,8,45,65],
]);
const expected = [
  {lines:[35,43,50,60,67,75], passed:[35,43,50,60,67,75], recovered:[1,.7,.45]},
  {lines:[50,58,65,75,82,90], passed:[50,58,65], recovered:[.5,.35,.225]},
  {lines:[60,68,75,85,92,100], passed:[60,68,75,85], recovered:[1,.35,.225]},
  {lines:[45,53,60,70,77,85], passed:[45,53,60,70,77], recovered:[1,.7,.225]},
  {lines:[70,78,85,95,102,110], passed:[70,78], recovered:[0,.35,.225]},
  {lines:[55,63,70,80,87,95], passed:[55], recovered:[0,0,.225]},
  {lines:[80,88,95,105,112,120], passed:[80,88,95], recovered:[.5,.35,.225]},
  {lines:[25,33,40,50,57,65], passed:[25,33,40,50,57,65], recovered:[1,.7,.45]},
];
const signatures = new Set();
const types = new Set();
variants.forEach((v, i) => {
  assert([-1,0].includes(v.low));
  assert([.25,.5,.75].includes(v.duty));
  assert(Number.isInteger(v.rate1) && Number.isInteger(v.rate2));
  assert(v.rate1 >= 5 && v.rate1 < v.rate2 && v.rate2 <= 25);
  assert(v.channelBand > 0 && v.channelBand <= 25);
  assert(v.carrier >= 40 && v.carrier <= 100 && v.carrier % 5 === 0);
  assert(v.cutoff >= 40 && v.cutoff <= 125 && v.cutoff % 5 === 0);
  assert(m.validateSampling(v.carrier, v.rate2));
  const result = m.translatedToneSpectrum(v.carrier, v.cutoff);
  assert.deepEqual(result.translated.map(x => x.frequencyKhz), expected[i].lines);
  assert.deepEqual(result.passed.map(x => x.frequencyKhz), expected[i].passed);
  assert.deepEqual(result.rejected.map(x => x.frequencyKhz),
    expected[i].lines.filter(f => !expected[i].passed.includes(f)));
  assert.deepEqual(result.recovered.map(x => x.amplitude), expected[i].recovered);
  for (const tone of result.baseband) {
    const pair = result.translated.filter(x => Math.abs(x.frequencyKhz - v.carrier) === tone.frequencyKhz);
    assert.deepEqual(pair.map(x => x.frequencyKhz).sort((a,b) => a-b),
      [v.carrier - tone.frequencyKhz, v.carrier + tone.frequencyKhz]);
    assert(pair.every(x => x.amplitude === tone.amplitude / 2));
  }
  signatures.add(JSON.stringify(v));
  const ratios = result.recovered.map((x, j) => x.amplitude / result.baseband[j].amplitude);
  if (ratios.every(x => x === 1)) types.add('full');
  if (ratios.every(x => x === .5)) types.add('uniform-scale');
  if (new Set(ratios).size > 1) types.add('distorted');
  if (ratios.includes(0)) types.add('lost-tone');
  if (result.baseband.some(t => result.passed.filter(x => Math.abs(x.frequencyKhz-v.carrier) === t.frequencyKhz).length === 1)) types.add('single-sideband');
  if (result.baseband.some(t => result.passed.filter(x => Math.abs(x.frequencyKhz-v.carrier) === t.frequencyKhz).length === 2)) types.add('both-sidebands');
});
assert.equal(signatures.size, 8);
assert.deepEqual([...types].sort(), ['both-sidebands','distorted','full','lost-tone','single-sideband','uniform-scale']);
""")
