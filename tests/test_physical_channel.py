"""Exercise the shipped ES module: combined impairments and full design space."""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run_js(assertions):
    uri = (ROOT / 'course/interactives/physical-channel-model.js').as_uri()
    script = f"""
import assert from 'node:assert/strict';
const m = await import({json.dumps(uri)});
const close = (a,b) => assert(Math.abs(a-b)<1e-9, `${{a}} != ${{b}}`);
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', script],
                            cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_trials_follow_link_budget_packet_curve_and_same_environment():
    run_js("""
const p={bandwidth:10,modulation:'QPSK',antenna:'panel',coding:'3/4',power:12};
const r=m.design(p);
assert.deepEqual(r,m.design(p));assert.equal(r.samples.length,300);
close(r.eirp,16);close(r.nominalRate,12);close(r.noise,-94+10*Math.log10(2));
const e=m.environment();
for(let i=0;i<r.samples.length;i++) {
  const s=r.samples[i];assert.equal(s.time,i);close(s.loss,e[i].loss);
  close(s.received,12+8-s.loss);close(s.snr,s.received-r.noise);
  close(s.rate,s.supported?r.operatingRate:0);
  assert.equal(s.bler,s.supported?.01:null);assert.equal(s.supported,s.snr>=r.requiredSnr);
}
const other=m.design({...p,power:6});
assert.deepEqual(other.samples.map(s=>s.loss),r.samples.map(s=>s.loss));
for(let i=0;i<r.samples.length;i++)close(r.samples[i].snr-other.samples[i].snr,6);
""")


def test_independent_resource_tradeoffs_have_multiple_feasible_solutions():
    run_js("""
const narrow={bandwidth:5,modulation:'16-QAM',antenna:'panel',coding:'3/4',power:16};
const lowPower={bandwidth:10,modulation:'QPSK',antenna:'panel',coding:'3/4',power:11};
const easyMount={bandwidth:10,modulation:'QPSK',antenna:'omni',coding:'3/4',power:19};
for(const p of [narrow,lowPower,easyMount])assert(m.design(p).feasible);
assert(narrow.bandwidth<lowPower.bandwidth);assert(lowPower.power<narrow.power);
assert.equal(m.ANTENNAS[easyMount.antenna].gain,0);
const max=m.design({bandwidth:10,modulation:'64-QAM',antenna:'dish',coding:'3/4',power:18});
assert(!max.legal && !max.feasible);assert.equal(max.eirp,26);assert.deepEqual(max.samples,[]);
assert(!m.design(m.designDefaults()).feasible);
""")


def test_fading_is_the_only_time_varying_cause_and_snr_extrema_match_passport():
    run_js("""
const p={bandwidth:5,modulation:'16-QAM',antenna:'panel',coding:'3/4',power:14};
const r=m.design(p);assert(!r.feasible && r.averageRate>10 && r.minimumRate<10);
const trace=m.environment();
close(Math.min(...trace.map(s=>s.loss)),m.CHANNEL.minimumLoss);
close(Math.max(...trace.map(s=>s.loss)),m.CHANNEL.maximumLoss);
close(r.snrRange.minimum,14+8-95-r.noise);close(r.snrRange.maximum,14+8-87-r.noise);
close(Math.min(...r.samples.map(s=>s.snr)),r.snrRange.minimum);
close(Math.max(...r.samples.map(s=>s.snr)),r.snrRange.maximum);
close(r.snrRange.maximum-r.snrRange.minimum,8);
for(let i=1;i<r.samples.length;i++) {
 close(r.samples[i].snr-r.samples[i-1].snr,-(r.samples[i].loss-r.samples[i-1].loss));
 assert(!('angle' in r.samples[i]) && !('pointingLoss' in r.samples[i]));
}
assert(m.design({...p,power:16}).feasible);
""")


def test_boundary_combinations_metrics_and_invalid_inputs():
    run_js("""
for(const bandwidth of [1,10,20])for(const modulation of Object.keys(m.MODES))
for(const antenna of Object.keys(m.ANTENNAS))
for(const coding of Object.keys(m.CODINGS))for(const power of [0,12,24])
{
  const r=m.design({bandwidth,modulation,antenna,coding,power});
  if(!r.legal) {assert(!r.feasible);assert(r.eirp>20);continue;}
  assert(r.samples.every(s=>Number.isFinite(s.rate)));
  close(r.minimumRate,Math.min(...r.samples.map(s=>s.rate)));
  close(r.averageRate,r.samples.reduce((sum,s)=>sum+s.rate,0)/300);
  assert.equal(r.feasible,r.minimumRate>=10);
  assert.equal(r.feasible,r.samples.every(s=>s.rate>=10));
  close(r.rateReserve,r.operatingRate-10);
}
for(const overrides of [{bandwidth:0},{modulation:'256-QAM'},{antenna:'missing'},{coding:'1/3'},{bandwidth:1.5},{power:12.5},{power:NaN}])
 assert.throws(()=>m.design({...m.designDefaults(),...overrides}),RangeError);

""")


def test_coding_rate_noise_bandwidth_and_equal_antenna_budgets():
    run_js("""
const p={bandwidth:7,modulation:'16-QAM',coding:'2/3',power:13,antenna:'panel'};
const r=m.design(p);assert(r.legal);close(r.eirp,17);close(r.nominalRate,7*4*(2/3)*.8);
close(r.noise,-94+10*Math.log10(7/5));close(r.threshold,20.5);
for(const s of r.samples) {
 close(s.received,13+2*4-s.loss);

}
const swapped=m.design({...p,antenna:'dish'});
assert(!swapped.legal);close(swapped.eirp,21); // Only one antenna gain enters transmitter EIRP.
for(const [coding,c] of Object.entries(m.CODINGS)) {
 const a=m.design({...p,coding});
 close(a.nominalRate,7*4*c.rate*.8);close(a.threshold,22+c.thresholdShift);
 assert.deepEqual(a.samples.map(s=>s.snr),r.samples.map(s=>s.snr));
}
const narrow=m.design({...p,bandwidth:1}),wide=m.design({...p,bandwidth:20});
close(wide.noise-narrow.noise,10*Math.log10(20));
close(wide.nominalRate/narrow.nominalRate,20);
for(let i=0;i<r.samples.length;i++)close(narrow.samples[i].snr-wide.samples[i].snr,10*Math.log10(20));
""")


def test_calculated_power_interval_predicts_a_conservative_candidate():
    run_js("""
const p={bandwidth:6,modulation:'16-QAM',coding:'2/3',antenna:'panel'};
const nominal=6*4*(2/3)*.8, threshold=22-1.5;
const noise=-94+10*Math.log10(6/5);
const requiredSnr=threshold;
assert(nominal*.99>=10);

const minPower=Math.ceil(noise+requiredSnr+95-8),maxPower=20-4;
assert(minPower>0 && minPower<=maxPower && maxPower-minPower<5);
for(let power=minPower;power<=maxPower;power++) {
 const r=m.design({...p,power});assert(r.legal && r.feasible);
 assert(r.samples.every(s=>s.rate>=10));
}
""")


def test_fixed_bler_requires_both_rate_and_snr_and_resources_restore_feasibility():
    run_js("""
const p={bandwidth:5,modulation:'16-QAM',coding:'3/4',antenna:'panel',power:14};
const weak=m.design(p),strong=m.design({...p,power:16});
assert(weak.checks.rate && !weak.checks.snr && !weak.feasible);assert(strong.feasible);
assert(weak.reserveSnr<0 && strong.reserveSnr>0);assert.equal(weak.minimumRate,0);
close(strong.operatingRate,strong.nominalRate*.99);close(strong.minimumRate,strong.operatingRate);
close(weak.reserveSnr,weak.snrRange.minimum-weak.requiredSnr);close(weak.requiredSnr,22);
close(strong.reserveSnr-weak.reserveSnr,2);close(strong.operatingRate,weak.operatingRate);
const slow=m.design({...p,bandwidth:1,power:16});
assert(!slow.checks.rate && slow.checks.snr && !slow.feasible);
assert.equal(strong.targetBler,.01);
for(const s of weak.samples)assert.equal(s.bler,s.supported?.01:null);
assert(!('availability' in strong));assert(!('meanPacketLoss' in strong));
""")
