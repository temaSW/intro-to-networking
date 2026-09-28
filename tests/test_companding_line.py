"""Checks for the real A-law examples and periodic line-code harmonics."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def test_g711_examples_and_line_code_harmonics():
    script = """
import assert from 'node:assert/strict';
import {compand, uniformPcm, lineCodes, SEGMENTS} from './course/interactives/companding-line-model.js';
import {LINE_SPECTRA as data} from './course/interactives/line-spectrum-data.js';

assert.deepEqual(SEGMENTS.map(item => item.base), [0, 16, 32, 64, 128, 256, 512, 1024]);
assert.deepEqual(SEGMENTS.map(item => item.step), [1, 1, 2, 4, 8, 16, 32, 64]);
assert.deepEqual(SEGMENTS.map(item => item.step / 2), [.5, .5, 1, 2, 4, 8, 16, 32]);
assert.deepEqual([uniformPcm(10).reconstructed, compand(10).reconstructed], [8, 10.5]);
assert.deepEqual([uniformPcm(1530).reconstructed, compand(1530).reconstructed], [1528, 1504]);
assert.equal(compand(10).wireWord, '11011111');
assert.equal(compand(1530).wireWord, '10100010');
assert.equal(compand(2047).segment, 7);
assert.deepEqual(data.comparisons.map(item => item.pattern), ['10', '110', '10000']);
for (const comparison of data.comparisons) for (const key of comparison.keys) {
  const lines = comparison.spectra[key].lines;
  assert(lines.every(line => line.amplitude >= 0 && line.amplitude <= 100));
  assert(lines.every((line, index) => index === 0 || line.frequency > lines[index - 1].frequency));
}
for (const comparison of data.comparisons) {
  assert.equal(Math.max(...comparison.keys.flatMap(key => comparison.spectra[key].lines.map(line => line.amplitude))), 100);
}
const [unipolar, ami, synchronizing] = data.comparisons;
assert.equal(unipolar.spectra.nrz.lines.find(line => line.frequency === 1).amplitude, 0);
assert(unipolar.spectra.rz.lines.find(line => line.frequency === 1).amplitude >= 49);
assert.equal(ami.spectra.amiNrz.lines[0].amplitude, 0);
assert.equal(ami.spectra.amiRz.lines[0].amplitude, 0);
assert.equal(synchronizing.spectra.hdb.periodBits, 10);
const bits = lineCodes('111000000000');
assert.equal(bits.hdb.filter(cell => cell.marker === 'V').length, 2);
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr
