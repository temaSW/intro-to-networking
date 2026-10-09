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


def test_known_fragment_estimates_frequency_and_compensates_data():
    run_js("""
for(const hz of [-80,-35,0,35,80]) for(const length of [8,32,64]) {
 const d=m.frequency({hz,length});
 assert(Math.abs(d.estimate-hz)<1e-10);
 assert(d.evm<1e-10);
 assert.equal(d.errors,0);
}
const d=m.frequency({hz:35,length:32,snr:15});
assert(d.evm<d.rawEvm);
assert(d.errors<d.rawErrors);
assert(d.evm>0);
assert.deepEqual(d,m.frequency({hz:35,length:32,snr:15}));
for(const snr of [0,5,20]) m.frequency({snr}).corrected.flat().forEach(v=>assert(Number.isFinite(v)));
""")


def test_bootstrap_is_demodulated_and_controls_the_payload_decoder():
    run_js("""
for(const mode of ['BPSK','QPSK','16-QAM']) {
 const frame=m.bootstrapFrame(mode),header=m.readBootstrap(frame.header);
 assert.equal(frame.header.length,10);
 assert.equal(header.mode,mode);
 assert.equal(header.symbols,frame.payload.length);
 const decoded=m.decodePayload(frame.payload.slice(0,header.symbols),header.mode);
 assert.equal(decoded.bits,frame.payloadBits);
 assert.equal(decoded.text,frame.message);
 for(const guess of ['BPSK','QPSK','16-QAM']) {
  const bits=m.decodePayload(frame.payload,guess).bits;
  assert.equal(bits===frame.payloadBits,guess===mode);
 }
 assert.equal(frame.totalSymbols,15+10+frame.payload.length);
}
// A header field change changes the receiver configuration; it does not read frame.mode.
const frame=m.bootstrapFrame('QPSK');
frame.header[0]=[1,0];frame.header[1]=[-1,0];
assert.equal(m.readBootstrap(frame.header).mode,'16-QAM');
""")


def test_access_conserves_devices_and_distinguishes_empty_collision_success():
    run_js("""
assert.equal(m.access({n:1}).share,1);
let sum=0;
for(let seed=1;seed<=3000;seed++) {
 const d=m.access({n:16,m:8,seed});
 assert.equal(d.first.successes.length+d.first.collided.length,16);
 assert.equal(new Set(d.first.bins.flat()).size,16);
 assert.equal(d.first.bins.filter(b=>b.length===1).length+d.first.conflicts+d.empty,8);
 assert.equal(d.share,d.first.successes.length/16);
 d.choices.forEach(([id,choice])=>assert(d.first.bins[choice].includes(id)));
 sum+=d.first.successes.length;
}
assert(Math.abs(sum/3000-m.access({n:16,m:8}).expected)<.15);
""")


def test_allocation_conserves_resource_and_grants_only_requested_cells():
    run_js("""
for(const demands of [[0,0,0],[4,8,12],[24,24,24,24],[0,24]]) for(const rows of [2,4,6]) {
 const d=m.allocation({demands,rows});
 assert.equal(d.cells.length,rows*8);
 assert.equal(d.granted.reduce((a,v)=>a+v,0)+d.unused+d.reserved,d.total);
 assert.equal(d.granted.reduce((a,v)=>a+v,0),Math.min(d.capacity,demands.reduce((a,v)=>a+v,0)));
 const used=new Set();
 demands.forEach((v,id)=>{
  assert(d.granted[id]<=v);
  assert.equal(d.granted[id]+d.unmet[id],v);
  assert.equal(d.assignments[id].length,d.granted[id]);
  d.assignments[id].forEach(({time,frequency})=>{
   const index=(frequency-1)*8+time-1;
   assert.equal(d.cells[index],id);assert(!used.has(index));used.add(index);
  });
 });
}
assert.deepEqual(m.allocation({demands:[24,24,24],rows:4}).granted,[10,10,10]);
""")


def test_ofdm_pilots_estimate_complex_channel_and_equalize_data():
    run_js("""
const dense=m.pilots({spacing:2,depth:.9}),sparse=m.pilots({spacing:16,depth:.9});
assert(dense.overhead>sparse.overhead);
assert(dense.rmse<sparse.rmse);
assert(dense.evm<sparse.evm);
assert(dense.evm<dense.rawEvm);
const noisyDense=m.pilots({spacing:2,snr:10}),noisySparse=m.pilots({spacing:16,snr:10});
noisyDense.data.filter(k=>noisySparse.data.includes(k)).forEach(k=>{
 assert.deepEqual(noisyDense.transmitted[k],noisySparse.transmitted[k]);
 assert.deepEqual(noisyDense.received[k],noisySparse.received[k]);
});
for(const spacing of [2,8,16]) for(const snr of [Infinity,0,10]) {
 const d=m.pilots({spacing,snr,depth:.95});
 assert.equal(d.positions.length+d.data.length,64);
 assert.equal(d.positions[0],0);assert.equal(d.positions.at(-1),63);
 d.positions.forEach((k,i)=>{
  assert.deepEqual(d.transmitted[k],[1,0]);
  // Pilot is +1: Y/X is exactly received Y, including noise.
  assert.deepEqual(d.observations[i],d.received[k]);
  if(snr===Infinity) d.estimates[k].forEach((v,j)=>assert(Math.abs(v-d.channel[k][j])<1e-12));
 });
 d.recovered.flat().forEach(v=>assert(Number.isFinite(v)));
 assert(d.errors<=d.data.length);
}
// With a pilot on every carrier, the model estimates H exactly (no noise).
const exact=m.pilots({spacing:1});
assert(exact.rmse<1e-12);
""")
