"""Numerical invariants of the instructional quantizers and sampling model."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_quantization_bounds_overload_and_companding():
    script = r"""
import assert from 'node:assert/strict';
import {quantize, quantizedWave} from './course/interactives/quantization-model.js';
import {sampledTone} from './course/interactives/sampling-model.js';
for (let bits = 2; bits <= 8; bits++) {
  let last = -Infinity;
  for (let k = -1000; k <= 1000; k++) {
    const x = k / 1000;
    const u = quantize(x, bits);
    assert(Math.abs(u.error) <= 1 / 2 ** bits + 1e-12);
    for (const law of ['uniform', 'log']) {
      const q = quantize(x, bits, law);
      assert(q.lower <= x + 1e-12 && x <= q.upper + 1e-12);
      assert(q.reconstructed >= q.lower && q.reconstructed <= q.upper);
      assert.equal(parseInt(q.word, 2), q.index);
      assert.equal(q.word.length, bits);
    }
    const q = quantize(x, bits, 'log');
    assert(q.reconstructed >= last);
    last = q.reconstructed;
  }
}
assert(quantize(1.4, 4).overloaded);
assert(Math.abs(quantize(1.4, 4).error) > 1 / 16);
assert.equal(quantize(1.4, 4).word, quantize(1, 4).word);
assert.equal(quantize(-1.4, 4).word, quantize(-1, 4).word);
assert(quantizedWave(.1, 4, 'log').rmsError < quantizedWave(.1, 4).rmsError);
assert(quantizedWave(.9, 4, 'log').rmsError > quantizedWave(.9, 4).rmsError);
assert.equal(quantizedWave(.7, 4).overloads, 0);
assert(quantizedWave(1.4, 4).overloads > 0);
const complexU = quantizedWave(.8, 4);
const complexL = quantizedWave(.8, 4, 'log');
assert(Math.abs(Math.max(...complexU.samples.map(p => Math.abs(p.value))) - .8) < 1e-12);
assert.equal(complexU.overloads, 0);
for (let k = 0; k < 33; k++) assert.equal(complexU.samples[k].value, complexL.samples[k].value);
const localRms = (wave, predicate) => {
  const points = wave.samples.filter(predicate);
  return Math.sqrt(points.reduce((s, p) => s + p.error ** 2, 0) / points.length);
};
const quiet = p => Math.abs(p.value) < .1, peak = p => Math.abs(p.value) > .3;
assert(localRms(complexL, quiet) < localRms(complexU, quiet));
assert(localRms(complexL, peak) > localRms(complexU, peak));
assert(quantizedWave(1.4, 4).overloads > 0);
const tone = sampledTone(1.2, 2);
assert(tone.aliases);
for (const p of tone.samples) assert(Math.abs(tone.apparent(p.timeMs) - p.amplitude) < 1e-10);
assert.equal(sampledTone(1.2, 3).aliases, false);
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                            text=True, capture_output=True, check=False)
    assert result.returncode == 0, result.stderr
