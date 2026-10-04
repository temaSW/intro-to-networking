"""Physical invariants of the actual browser model, executed without npm packages."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "course/interactives/channel-playground-model.js"


def run_js(assertions):
    script = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
const p = m.defaults();
const close = (a,b) => assert(Math.abs(a-b) < 1e-9, `${{a}} != ${{b}}`);
{assertions}
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script],
                            cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_link_budget_distance_and_power():
    run_js("""
const a = m.attenuation({...p, loss:0, distance:1});
const b = m.attenuation({...p, loss:0, distance:2});
close(b.lossDb-a.lossDb, 20*Math.log10(2));
close(a.received, p.power-a.lossDb);
close(a.margin, a.received-p.sensitivity);
const strong = m.attenuation({...p,power:p.power+10});
close(strong.margin-m.attenuation(p).margin,10);
assert.equal(m.attenuation({...p,distance:20,loss:5}).usable,false);
assert.equal(m.attenuation({...p, aid:'amplifier'}).received,m.attenuation(p).received);
""")


def test_bandwidth_and_rate_reduce_isi_at_fixed_amplitude():
    run_js("""
const narrow = {...p, bandwidth:.3, rate:8};
const a = m.bandwidth(narrow);
assert.equal(a.amplitude,1);
assert(m.bandwidth({...narrow,bandwidth:10}).tail < a.tail);
assert(m.bandwidth({...narrow,rate:1}).tail < a.tail);
assert.deepEqual(m.bandwidth({...p,bandwidth:20,rate:1}).decisions,m.BITS);
assert(a.rx.every(x=>Math.abs(x)<=1));
close(m.lowpassGain(p.bandwidth,p.bandwidth),1/Math.sqrt(2));
""")


def test_noiseless_bypass_and_nf_calibrated_amplifier_noise():
    run_js("""
const weak={...p,power:0,distance:20,loss:5};
const bare=m.attenuationSignal(weak), amp=m.attenuationSignal({...weak,aid:'amplifier'});
assert.deepEqual(bare.input,bare.output);
assert(bare.addedNoise.every(x=>x===0));
assert.equal(bare.addedNoiseWatts,0);
const ideal=m.attenuationSignal({...weak,aid:'amplifier',noiseFigure:0});
assert(ideal.addedNoise.every(x=>x===0));
const expected=16*(10**(p.noiseFigure/10)-1)*1.380649e-23*290*100e6;
assert(Math.abs(amp.addedNoiseWatts/expected-1)<1e-12);
const thresholdWatts=1e-3*10**(weak.sensitivity/10);
const measured=amp.addedNoise.reduce((v,x)=>v+x*x,0)/amp.addedNoise.length*thresholdWatts;
assert(Math.abs(measured/expected-1)<1e-12);
for(let i=0;i<bare.input.length;i++) {
  close(bare.input[i],bare.tx[i]*10**((m.attenuation(weak).received-weak.sensitivity)/20));
  close(ideal.output[i],4*bare.input[i]);
  close(amp.output[i],4*bare.input[i]+amp.addedNoise[i]);
}
const noisier=m.attenuationSignal({...weak,aid:'amplifier',noiseFigure:12});
assert(noisier.addedNoiseWatts>amp.addedNoiseWatts);
close(noisier.outputLevel,amp.outputLevel);
// Changing the normalization threshold must not change physical noise power.
close(m.attenuationSignal({...weak,aid:'amplifier',sensitivity:-90}).noiseDbm,amp.noiseDbm);
""")


def test_isi_regeneration_restores_pulses_but_preserves_wrong_bits():
    run_js("""
const weak=m.bandwidth({...p,bandwidth:.1,rate:20,regeneration:'on'});
assert(weak.errors>0);
for(let i=0;i<weak.regenerated.length;i++) {
  close(weak.regenerated[i],weak.decisions[Math.floor(i/64)]?1:-1);
  close(weak.regeneratedTime[i]-weak.time[i],1/20);
}
const clear=m.bandwidth({...p,bandwidth:20,rate:1,regeneration:'on'});
assert.equal(clear.errors,0);
assert.deepEqual(clear.regenerated,clear.tx);
""")


def test_noise_decisions_and_structured_interference():
    run_js("""
const clear=m.noisySymbols({...p,snr:24}), noisy=m.noisySymbols({...p,snr:-12});
assert.equal(clear.errors,0);
assert(noisy.errors>0);
assert.deepEqual(noisy,m.noisySymbols({...p,snr:-12}));
const variance = n => n.points.reduce((v,x)=>v+(x.re-x.tx)**2+x.im**2,0);
assert(variance(noisy)>variance(clear));
for(const point of m.noisySymbols({...p,disturbance:'interference',interference:1.7}).points) {
  close(Math.hypot(point.re-point.tx,point.im),1.7);
  assert.equal(point.error,point.decision!==point.bit);
}
""")


def test_delayed_copies_and_frequency_cancellation_share_model():
    run_js("""
const paths=[{amplitude:1,delay:0},{amplitude:1,delay:.5}];
close(m.response(paths,1).magnitude,0);
close(m.response(paths,2).magnitude,2);
const wave=m.multipath({...p,carrier:1,paths:[{amplitude:1,delay:.5,angle:90}]});
for(let i=0;i<wave.time.length;i++) close(wave.sum[i],wave.copies[0][i]+wave.copies[1][i]);
assert(wave.copies[1].slice(0,25).every(x=>x===0));
for(let i=30;i<290;i++) close(wave.sum[i],0);
""")


def test_delay_spread_scaling_and_degenerate_paths():
    run_js("""
const a=m.coherence(p), b=m.coherence({...p, paths:p.paths.map(x=>({...x,delay:x.delay*2}))});
close(b.rms,a.rms*2);
close(b.bc,a.bc/2);
assert.equal(m.coherence({...p,paths:[]}).bc,Infinity);
assert.equal(m.coherence({...p,paths:[{amplitude:0,delay:5}]}).bc,Infinity);
close(m.coherence({...p,f1:1,f2:1}).difference,0);
""")


def test_doppler_shift_sources_and_directions():
    run_js("""
close(m.doppler(2,30,0),-m.doppler(2,30,180));
close(m.doppler(2,30,90),0);
close(m.doppler(4,30,0),2*m.doppler(2,30,0));
assert.equal(m.frequencyShift({...p,speed:0,offset:125}).total,125);
const f=m.frequencyShift({...p,offset:125}); close(f.total,f.motion+125);
""")


def test_shift_is_not_spread_and_time_resolution():
    run_js("""
const single=m.dopplerSpread({...p,paths:[]});
assert.equal(single.spread,0); assert.equal(single.tc,Infinity);
for(const h of single.h) close(h.magnitude,1);
const same=m.dopplerSpread({...p,direction:60,paths:[{amplitude:.7,delay:.5,angle:60}]});
assert.equal(same.spread,0);
for(const h of same.h) close(h.magnitude,same.h[0].magnitude);
const a=m.dopplerSpread(p), b=m.dopplerSpread({...p,speed:p.speed*2});
close(b.spread,2*a.spread); close(b.tc,a.tc/2);
assert(a.h.some(h=>Math.abs(h.magnitude-a.h[0].magnitude)>.1));
const extreme=m.dopplerSpread({...p,speed:60,carrierGHz:6,duration:100,paths:[{amplitude:1,delay:1,angle:180}]});
assert(1/(extreme.time[1]-extreme.time[0]) >= 19*Math.max(...extreme.shifts.map(Math.abs)));
assert(extreme.h.every(h=>Number.isFinite(h.magnitude)));
""")


def test_component_import_and_page_embedding():
    result = subprocess.run(["node", "--input-type=module", "-e",
        "globalThis.document={querySelectorAll:()=>[]}; const m=await import('./course/interactives/channel-playground-ui.js'); if(typeof m.mountChannelPlayground!=='function') throw Error('Missing mount');"],
        cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    page = (ROOT / "course/lectures/channel-playground.qmd").read_text(encoding="utf-8")
    assert 'data-channel-playground' in page
    assert 'channel-playground-ui.js' in page
