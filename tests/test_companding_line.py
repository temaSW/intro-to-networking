"""Checks for the real A-law examples and averaged line-code spectra."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def test_g711_examples_and_spectral_estimate():
    script = """
import assert from 'node:assert/strict';
import {compand, uniformPcm, lineCodes} from './course/interactives/companding-line-model.js';
import {LINE_SPECTRA as data} from './course/interactives/line-spectrum-data.js';

assert.deepEqual([uniformPcm(20).reconstructed, compand(20).reconstructed], [16, 21]);
assert.deepEqual([uniformPcm(3060).reconstructed, compand(3060).reconstructed], [3056, 3008]);
assert.equal(compand(20).wireWord, '11011111');
assert.equal(compand(3060).wireWord, '10100010');
assert.deepEqual(Object.keys(data.spectra), ['nrz', 'rz', 'amiNrz', 'amiRz', 'manchester', 'hdb']);
assert.equal(data.bitCount, 131072);
assert.equal(data.fftSize, 32768);
assert.equal(data.windows, 63);
for (const estimate of Object.values(data.spectra)) {
  assert.equal(estimate.relativePower.length, 501);
  assert(estimate.relativePower.every(value => value >= 0 && value <= 1));
}
assert(data.spectra.nrz.mean > 0.49 && data.spectra.nrz.mean < 0.51);
assert(data.spectra.rz.mean > 0.24 && data.spectra.rz.mean < 0.26);
assert(Math.abs(data.spectra.amiNrz.mean) < 0.01);
assert(Math.abs(data.spectra.manchester.mean) < 0.01);
assert(data.spectra.nrz.relativePower[0] > data.spectra.amiNrz.relativePower[0] + .4);
const bits = lineCodes('111000000000');
assert.equal(bits.hdb.filter(cell => cell.marker === 'V').length, 2);
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr
