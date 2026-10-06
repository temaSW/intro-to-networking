"""Numerical and probabilistic invariants of the abstract agreement models."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / "course/interactives/transmission-agreement-model.js"


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
{assertions}
"""
    result = subprocess.run(["node", "--input-type=module", "-e", source], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_correlation_discriminates_shifts_and_finds_inserted_reference():
    run_js("""
const bits=m.correlationIllustration('bits');
assert.equal(bits.reference.length,15);
assert.equal(bits.stream.length,48);
assert.equal(bits.peakTime,18);
assert.equal(bits.scores[18],1);
assert(bits.scores.filter(v=>v===1).length===1);
assert(bits.stream.slice(0,8).every(v=>v===-1));
const cyclic=bits.reference.map((_,k)=>bits.reference.reduce((sum,v,i)=>sum+v*bits.reference[(i+k)%15],0)/15);
cyclic.slice(1).forEach(v=>assert(Math.abs(v+1/15)<1e-12));
const ones=m.correlationIllustration('ones');
assert(ones.reference.every(v=>v===1));
assert.equal(ones.scores[18],1);
assert(ones.scores[17]>bits.scores[17]);
assert(ones.scores[19]>bits.scores[19]);
assert.deepEqual(ones.stream.slice(0,18),bits.stream.slice(0,18));
assert.deepEqual(ones.stream.slice(33),bits.stream.slice(33));
for(const kind of ['bits','ones']) {
 const clean=m.correlationIllustration(kind,{samplesPerBit:8});
 const noisy=m.correlationIllustration(kind,{samplesPerBit:8,snr:6});
 const louder=m.correlationIllustration(kind,{samplesPerBit:8,snr:-4});
 const signalPower=noisy.sampledReference.reduce((a,v)=>a+v*v,0)/noisy.sampledReference.length;
 const noisePower=noisy.received.reduce((a,v,i)=>a+(v-noisy.clean[i])**2,0)/noisy.received.length;
 assert(Math.abs(10*Math.log10(signalPower/noisePower)-6)<1e-10);
 assert.deepEqual(clean.received,clean.clean);
 assert.deepEqual(noisy.received,m.correlationIllustration(kind,{samplesPerBit:8,snr:6}).received);
 noisy.received.forEach((v,i)=>assert(Math.abs((louder.received[i]-louder.clean[i])-Math.sqrt(10)*(v-noisy.clean[i]))<1e-10));
 noisy.scores.forEach((v,k)=>{
  const expected=noisy.sampledReference.reduce((sum,r,i)=>sum+r*noisy.received[k+i],0)/(signalPower*noisy.sampledReference.length);
  assert(Math.abs(v-expected)<1e-10);
 });
}
assert.equal(m.correlationIllustration('bits',{samplesPerBit:8}).scores[18*8],1);

""")


def test_clock_error_accumulates_and_frequency_correction_stops_rotation():
    run_js("""
assert.equal(m.timing({ppm:0,elapsed:10000}).drift,0);
assert(Math.abs(m.timing({ppm:100,elapsed:5000}).drift+.5)<.001);
assert(m.timing({ppm:-100}).drift>0);
const tracked=m.timing({ppm:500,elapsed:10000,tracking:true});
tracked.points.forEach(p=>assert.equal(p.t,p.k+.5));
for(const hz of [-50,-10,0,10,50]) {
 const d=m.frequency({hz,ms:100,compensate:true});
 assert(Math.abs(d.residual)<1e-10);
 d.received.forEach((p,i)=>p.forEach((v,j)=>assert(Math.abs(v-d.reference[i][j])<1e-10)));
}
assert(Math.abs(m.frequency({hz:10,ms:25}).angle-Math.PI/2)<1e-10);
assert.equal(m.frequency({hz:10,compensate:true,estimateError:2}).residual,-2);
""")


def test_access_preserves_devices_and_matches_expected_success_rate():
    run_js("""
assert.equal(m.access({n:1}).probability,1);
assert.equal(m.access({n:1}).successes,1);
let sum=0;
for(let seed=1;seed<=4000;seed++) {
 const d=m.access({n:24,m:16,windows:4,seed});
 assert.equal(d.first.successes.length+d.first.collided.length,24);
 assert.equal(d.retry.successes.length+d.retry.collided.length,d.first.collided.length);
 assert.equal(new Set(d.retry.bins.flat()).size,d.first.collided.length);
 assert(d.successes<=24);
 sum+=d.first.successes.length;
}
assert(Math.abs(sum/4000-m.access({n:24,m:16}).expected)<.2);
""")


def test_pilot_density_trades_resource_for_estimation_quality():
    run_js("""
const dense=m.pilots({spacing:2,period:40}), sparse=m.pilots({spacing:20,period:40});
assert(dense.overhead>sparse.overhead);
assert(dense.rmse<sparse.rmse);
assert(dense.errors<=sparse.errors);
for(const spacing of [2,8,24]) for(const period of [8,40,80]) {
 const d=m.pilots({spacing,period});
 assert.equal(d.positions.length+d.data.length,97);
 d.positions.forEach(t=>assert.equal(d.transmitted[t],1));
 d.recovered.forEach(v=>assert(Number.isFinite(v)));
 assert(d.errors<=d.data.length);
}
""")
