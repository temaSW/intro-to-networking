import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {modes, rates, parseBer, measuredThresholds, bestMode, availableModes, transmissionTime, linearSnr, capacity, checkNumber} from "../course/interactives/mcs-model.js";

const rows = parseBer(readFileSync(new URL("../course/data/lecture-04/nr-ber-awgn.csv", import.meta.url), "utf8"));
const catalog = measuredThresholds(rows);
test("information and useful rates for all five modes", () => {
  assert.deepEqual(modes.map(m => rates(m).information), [1, 1.5, 2, 3, 4.5]);
  modes.forEach((m, i) => assert.ok(Math.abs(rates(m).useful - [.8, 1.2, 1.6, 2.4, 3.6][i]) < 1e-12));
});
test("thresholds come from first passing measured samples", () => {
  assert.deepEqual(catalog.map(m => m.threshold), [2, 5, 7, 11, 17]);
  for (const m of catalog) {
    const samples = rows.filter(r => r.scheme === m.id);
    assert.ok(samples.find(r => r.snr_db === m.threshold).ber <= 1e-3);
    assert.ok(samples.filter(r => r.snr_db < m.threshold).every(r => r.ber > 1e-3));
  }
  assert.deepEqual(measuredThresholds([...rows].reverse()), catalog);
  assert.equal(measuredThresholds(rows, 1e-4)[0].threshold, 3);
});
test("selection respects threshold boundaries, gaps and no admissible mode", () => {
  assert.equal(bestMode(catalog, -4), null);
  assert.equal(bestMode(catalog, 1.999), null);
  [2, 5, 7, 11, 17].forEach((snr, i) => {
    assert.equal(bestMode(catalog, snr).id, i + 1);
    assert.equal(availableModes(catalog, snr).length, i + 1);
    assert.equal(bestMode(catalog, snr - .001)?.id ?? 0, i);
  });
  assert.equal(bestMode([...catalog].reverse(), 10.5).id, 3);
  assert.equal(bestMode(catalog, 19).id, 5);
  assert.equal(bestMode(measuredThresholds([], 1e-3), 19), null);
});
test("file transfer and full resource cannot satisfy 2 Mbps at 5 dB", () => {
  const fast = rates(bestMode(catalog, 17)).useful, slow = rates(bestMode(catalog, 5)).useful;
  assert.ok(Math.abs(transmissionTime(8, fast) - 20/9) < 1e-12);
  assert.ok(Math.abs(transmissionTime(8, slow) - 20/3) < 1e-12);
  assert.ok(Math.abs(fast / slow - 3) < 1e-12);
  assert.equal(rates(bestMode(catalog, 5), 1).useful, 1.5);
});
test("Shannon uses linear power SNR and MHz", () => {
  assert.ok(Math.abs(linearSnr(3) - 1.995262315) < 1e-9);
  assert.ok(Math.abs(linearSnr(7) - 5.011872336) < 1e-9);
  assert.ok(Math.abs(capacity(2, 3) - 3.165364709) < 1e-8);
  assert.ok(Math.abs(capacity(2, 7) - 5.175629) < 1e-5);
  assert.ok(capacity(2, 3) < 5 && capacity(2, 7) > 5);
});
test("student input accepts rounded comma decimals and rejects empty or invalid", () => {
  assert.ok(checkNumber(" 2,22 ", 20/9));
  assert.ok(checkNumber("6.67", 20/3));
  for (const value of ["", " ", "NaN", "Infinity", "2 Мбит/с", "2,2,2"]) assert.equal(checkNumber(value, 0), false);
  assert.equal(checkNumber("4.99", 5, 0), false);
  assert.equal(checkNumber("5", 5, 0), true);
});
