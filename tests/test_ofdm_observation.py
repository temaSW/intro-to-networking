"""Physical consistency of the fixed OFDM observation, using the shipped JS."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run_js(assertions):
    uri = (ROOT / 'course/interactives/ofdm-observation-model.js').as_uri()
    script = f"""
import assert from 'node:assert/strict';
const m = await import({json.dumps(uri)});
const close=(a,b,t=1e-9)=>assert(Math.abs(a-b)<t,`${{a}} != ${{b}}`);
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', script],
                            cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_ideal_ofdm_roundtrip_and_power_normalization():
    run_js("""
const r=m.observeOFDM({lossDb:0,gainDb:0,channelNoise:0,amplifierNoise:0,
  clip:1e9,frequencyOffsetKhz:0,paths:[{delay:0,re:1,im:0}]});
assert.equal(r.errors,0); assert.equal(r.clipped,0);
close(r.transmittedPower,1); close(r.receivedPower,1);
for(let i=0;i<r.points.length;i++) {
  close(r.points[i].i,r.txSymbols[i].i); close(r.points[i].q,r.txSymbols[i].q);
}
assert.equal(r.points.length,40*48); assert.equal(r.bitCount,40*48*2);
assert.equal(r.samples,40*(128+32));
const active=r.spectrum.filter(s=>r.carriers.includes(s.frequency*128/8));
for(const s of active) close(s.tx,10*Math.log10(1/48));
""")


def test_attenuation_is_voltage_loss_not_an_arbitrary_error_penalty():
    run_js("""
const p={gainDb:0,channelNoise:0,amplifierNoise:0,clip:1e9,frequencyOffsetKhz:0,
  paths:[{delay:0,re:1,im:0}]};
const a=m.observeOFDM({...p,lossDb:0}), b=m.observeOFDM({...p,lossDb:36});
close(b.receivedPower/a.receivedPower,10**(-36/10));
assert.equal(b.errors,0); // Attenuation alone cannot flip a noiseless sign decision.
for(let i=0;i<a.points.length;i++) {close(a.points[i].i,b.points[i].i);close(a.points[i].q,b.points[i].q);}
""")


def test_all_impairments_are_present_and_have_measurable_effects():
    run_js("""
const r=m.observeOFDM();
assert.deepEqual(r,m.observeOFDM());
assert(r.errors>0 && r.errors<r.bitCount);
assert(r.rxBits.slice(0,64).some((bit,i)=>bit!==r.txBits[i]));
assert(r.clipped>0 && r.clipped<r.samples);
assert(r.channelNoiseEnergy>0 && r.amplifierNoiseEnergy>0);
const gains=r.spectrum.filter(s=>Math.abs(s.frequency)<=1.5).map(s=>s.channelGain);
assert(Math.max(...gains)>1.8 && Math.min(...gains)<.2);
const linear=m.observeOFDM({clip:1e9});assert.equal(linear.clipped,0);
assert.notDeepEqual(linear.points,r.points);
const noChannelNoise=m.observeOFDM({channelNoise:0});
const noAmplifierNoise=m.observeOFDM({amplifierNoise:0});
assert.equal(noChannelNoise.channelNoiseEnergy,0);
assert.equal(noAmplifierNoise.amplifierNoiseEnergy,0);
assert.notDeepEqual(noChannelNoise.points,r.points);
assert.notDeepEqual(noAmplifierNoise.points,r.points);
""")


def test_spectrum_constellation_and_bits_describe_the_same_samples():
    run_js("""
const r=m.observeOFDM(), p=r.parameters;
let errors=0;
for(let j=0;j<r.points.length;j++) {
  const v=r.points[j];
  assert.equal(r.rxBits[2*j],v.i>=0?1:0); assert.equal(r.rxBits[2*j+1],v.q>=0?1:0);
  errors+=(r.rxBits[2*j]!==r.txBits[2*j])+(r.rxBits[2*j+1]!==r.txBits[2*j+1]);
}
assert.equal(errors,r.errors);
for(const carrier of r.carriers) {
  const points=r.points.filter(s=>s.carrier===carrier);
  const energy=points.reduce((a,b)=>a+b.i*b.i+b.q*b.q,0)/p.blocks;
  const bin=r.spectrum.find(s=>s.frequency===carrier*p.sampleRate/p.size);
  close(10**((bin.rx-p.transmitDbm)/10),energy*10**(-p.lossDb/10)/r.carriers.length,1e-12);
}
""")


def test_delayed_path_with_prefix_does_not_create_unmodelled_isi():
    run_js("""
const r=m.observeOFDM({lossDb:0,gainDb:0,channelNoise:0,amplifierNoise:0,
  clip:1e9,frequencyOffsetKhz:0,paths:[{delay:8,re:1,im:0}]});
for(let j=0;j<r.points.length;j++) {
  const v=r.points[j], tx=r.txSymbols[j], phase=-2*Math.PI*v.carrier*8/128;
  close(v.i,tx.i*Math.cos(phase)-tx.q*Math.sin(phase));
  close(v.q,tx.i*Math.sin(phase)+tx.q*Math.cos(phase));
}
""")


def test_invalid_sampling_prefix_and_other_parameters_are_rejected():
    run_js("""
for(const p of [{size:127},{size:128.5},{prefix:1},{blocks:0},{seed:0},
  {active:64},{channelNoise:-1},{clip:0},{noiseFigureDb:-1},{frequencyOffsetKhz:NaN},{equalizer:1},{sampleRate:Infinity}])
  assert.throws(()=>m.observeOFDM(p),RangeError);
""")


def test_cable_memory_matches_rc_transition_and_wide_cable_preserves_bits():
    run_js("""
const bits=[...Array(128).fill(0),...Array(24).fill(1)];
const r=m.cableWaveform(bits);
close(r.decisions[0].value,1-2*Math.exp(-Math.PI*.65/4.8));
assert.equal(r.decisions[0].bit,0); assert.equal(r.decisions[0].source,1);
const other=m.cableWaveform(Array(152).fill(1));
assert(other.decisions[0].value>.99); // Same current bit, different preceding bits.
assert.equal(m.cableWaveform(bits,{bandwidth:100}).errors,0);
assert(r.trace.every(v=>Math.abs(v.value)<=1+1e-12));
for(const options of [{rate:0},{bandwidth:0},{offset:1000},{count:0}])
  assert.throws(()=>m.cableWaveform(bits,options),RangeError);
""")


def test_cable_uses_receiver_bits_and_real_serial_bit_rate():
    run_js("""
const r=m.observeOFDM(), before=r.rxBits.slice();
const rate=2*r.carriers.length*r.parameters.sampleRate/(r.parameters.size+r.parameters.prefix);
close(rate,4.8);
const c=m.cableWaveform(r.rxBits,{rate});
assert.deepEqual(r.rxBits,before); assert.deepEqual(c.bits,r.rxBits.slice(128,152));
assert.equal(c.trace.length,24*64+1); close(c.duration,5);
close(c.trace.at(-1).time,c.duration);
assert.equal(c.errors,c.decisions.filter(v=>v.bit!==v.source).length);
assert(c.errors>0);
for(let i=0;i<c.count;i++) {
  close(c.decisions[i].time,(i+.5)/rate);
  assert.equal(c.decisions[i].source,c.bits[i]);
}
""")


def test_receiver_range_has_fixed_specs_and_measures_total_input_power():
    run_js("""
const r=m.observeOFDM(), d=r.receiverRange;
assert.equal(d.minimum,-50); assert.equal(d.maximum,-35);
assert(d.current>d.maximum && r.clipped>0);
assert.equal(d.maximum-d.minimum,15);
for(const overrides of [{seed:91},{gainDb:-4},{channelNoise:0},{paths:[{delay:0,re:1,im:0}]}]) {
  const altered=m.observeOFDM(overrides).receiverRange;
  assert.equal(altered.minimum,d.minimum); assert.equal(altered.maximum,d.maximum);
}
close(m.observeOFDM({gainDb:-4}).receiverRange.current,d.current);
assert(d.current>Math.max(...r.spectrum.map(v=>v.rx)));
const other=m.observeOFDM({sensitivityDbm:-60,maximumInputDbm:-30}).receiverRange;
assert.equal(other.minimum,-60); assert.equal(other.maximum,-30);
assert.throws(()=>m.observeOFDM({sensitivityDbm:-20,maximumInputDbm:-30}),RangeError);
""")


def test_equalizer_and_frequency_correction_remove_different_impairments():
    run_js("""
const p={channelNoise:0,amplifierNoise:0,clip:1e9};
const original=m.observeOFDM(p);
const frequencyOnly=m.observeOFDM({...p,frequencyAdjustmentKhz:7.5});
const eqOnly=m.observeOFDM({...p,equalizer:true});
const both=m.observeOFDM({...p,equalizer:true,frequencyAdjustmentKhz:7.5});
assert(original.errors>0 && frequencyOnly.errors>0 && eqOnly.errors>0);
assert.equal(both.errors,0);
for(let i=0;i<both.points.length;i++) {
  close(both.points[i].i,both.txSymbols[i].i);close(both.points[i].q,both.txSymbols[i].q);
}
assert.deepEqual(both.txBits,original.txBits);
assert.deepEqual(original.spectrum.map(v=>v.output),eqOnly.spectrum.map(v=>v.output));
assert.notDeepEqual(original.spectrum.map(v=>v.processed),eqOnly.spectrum.map(v=>v.processed));
""")


def test_oscillator_offset_physically_shifts_ofdm_spectrum():
    run_js("""
const p={lossDb:0,gainDb:0,channelNoise:0,amplifierNoise:0,clip:1e9,paths:[{delay:0,re:1,im:0}]};
const shifted=m.observeOFDM({...p,frequencyOffsetKhz:62.5});
const corrected=m.observeOFDM({...p,frequencyOffsetKhz:62.5,frequencyAdjustmentKhz:62.5});
assert(shifted.errors>0); assert.equal(corrected.errors,0);
for(let i=1;i<shifted.spectrum.length;i++) {
  const tx=10**(shifted.spectrum[i-1].tx/10),rx=10**(shifted.spectrum[i].rx/10);
  close(tx,rx,1e-10);
}
""")


def test_noise_figure_controls_added_noise_with_calibrated_reference():
    run_js("""
const ideal=m.observeOFDM({noiseFigureDb:0});
const three=m.observeOFDM({noiseFigureDb:3});
const ten=m.observeOFDM({noiseFigureDb:10});
assert.equal(ideal.parameters.amplifierNoise,0);assert.equal(ideal.amplifierNoiseEnergy,0);
close(ten.parameters.amplifierNoise,.001*Math.sqrt(9));
close(ten.amplifierNoiseEnergy/three.amplifierNoiseEnergy,9/(10**.3-1));
assert.deepEqual(ideal.txBits,ten.txBits);assert.notDeepEqual(ideal.points,ten.points);
""")


def test_gain_reduction_removes_overload_without_altering_channel_or_data():
    run_js("""
const overloaded=m.observeOFDM(), linear=m.observeOFDM({gainDb:18});
assert(overloaded.clipped>0);assert.equal(linear.clipped,0);
assert.deepEqual(overloaded.txBits,linear.txBits);
assert.deepEqual(overloaded.spectrum.map(v=>v.channelGain),linear.spectrum.map(v=>v.channelGain));
close(overloaded.receiverRange.current,linear.receiverRange.current);
for(const gainDb of [12,42]) for(const noiseFigureDb of [0,15]) for(const equalizer of [true,false]) {
  const r=m.observeOFDM({gainDb,noiseFigureDb,equalizer});
  assert(r.points.every(v=>Number.isFinite(v.i)&&Number.isFinite(v.q)));
}
""")


def test_amplifier_choices_trade_noise_for_output_headroom():
    run_js("""
const lowNoise=m.observeOFDM({...m.equipmentSettings('B',24),equalizer:true,frequencyAdjustmentKhz:7.5});
const highHeadroom=m.observeOFDM({...m.equipmentSettings('C',30),equalizer:true,frequencyAdjustmentKhz:7.5});
assert(lowNoise.parameters.noiseFigureDb<highHeadroom.parameters.noiseFigureDb);
assert(lowNoise.clipped>0 && highHeadroom.clipped===0);
assert(lowNoise.errors>highHeadroom.errors);
assert.throws(()=>m.equipmentSettings('B',12),RangeError);
assert.throws(()=>m.equipmentSettings('missing',30),RangeError);
""")


def test_cable_characteristics_affect_bandwidth_and_voltage():
    run_js("""
const bits=[...Array(128).fill(0),...Array(24).fill(1)];
const b=m.cableWaveform(bits,m.CABLES.B), c=m.cableWaveform(bits,m.CABLES.C);
assert.equal(b.errors,0);assert.equal(c.errors,0);
assert(m.CABLES.C.bandwidth>m.CABLES.B.bandwidth);
assert(m.CABLES.C.lossDb>m.CABLES.B.lossDb);
close(b.trace.at(-1).value,10**(-m.CABLES.B.lossDb/20));
close(c.trace.at(-1).value,10**(-m.CABLES.C.lossDb/20));
assert(c.trace.at(-1).value<b.trace.at(-1).value);
assert.throws(()=>m.cableWaveform(bits,{lossDb:-1}),RangeError);
""")


def test_manual_frequency_adjustment_has_an_interior_optimum():
    run_js("""
const settings={...m.equipmentSettings('C',30),equalizer:true};
const correct=m.observeOFDM({...settings,frequencyAdjustmentKhz:7.5});
for(const frequencyAdjustmentKhz of [-25,0,7,8,25]) {
  const r=m.observeOFDM({...settings,frequencyAdjustmentKhz});
  assert(r.errors>correct.errors);
  assert.deepEqual(r.txBits,correct.txBits);
}
assert.throws(()=>m.observeOFDM({frequencyAdjustmentKhz:NaN}),RangeError);
""")


def test_output_spectrum_tracks_gain_and_processing_without_renormalization():
    run_js("""
const settings={clip:1e9,frequencyAdjustmentKhz:7.5};
const low=m.observeOFDM({...settings,gainDb:12}), high=m.observeOFDM({...settings,gainDb:18});
for(let j=0;j<low.spectrum.length;j++) {
  close(high.spectrum[j].output-low.spectrum[j].output,6);
  close(low.spectrum[j].output,low.spectrum[j].processed);
}
let previous=0;
for(const gainDb of [12,18,24,30,36,42,48]) {
  const r=m.observeOFDM({gainDb});assert(r.outputPower>=previous);previous=r.outputPower;
}
const eq=m.observeOFDM({...settings,gainDb:18,equalizer:true});
assert.deepEqual(eq.spectrum.map(v=>v.output),high.spectrum.map(v=>v.output));
assert.notDeepEqual(eq.spectrum.map(v=>v.processed),high.spectrum.map(v=>v.processed));
for(const carrier of eq.carriers) {
  const points=eq.points.filter(v=>v.carrier===carrier);
  const energy=points.reduce((sum,v)=>sum+v.i*v.i+v.q*v.q,0)/eq.parameters.blocks;
  const bin=eq.spectrum.find(v=>v.frequency===carrier*8/128);
  close(10**(bin.processed/10),energy*10**((18-36)/10)/48,1e-12);
}
const ideal=m.observeOFDM({...settings,gainDb:18,equalizer:true,channelNoise:0,amplifierNoise:0});
for(const bin of ideal.spectrum.filter(v=>ideal.carriers.includes(v.frequency*128/8)))
  close(bin.processed,10*Math.log10(1/48)+18-36);
""")
