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


def test_each_variant_has_about_a_hundred_solutions_in_the_complete_pool():
    run_js("""
assert.deepEqual(Object.keys(m.VARIANTS).map(Number),[1,2,3,4,5,6,7,8]);
const pools=[];
for(const variant of Object.keys(m.VARIANTS).map(Number)) {
 const accepted=new Set(),modes=new Set(),antennas=new Set(),c=m.variantSettings(variant);
 for(const bandwidth of m.DESIGN_OPTIONS.bandwidth)for(const power of m.DESIGN_OPTIONS.power)
 for(const modulation of Object.keys(m.MODES))for(const coding of Object.keys(m.CODINGS))
 for(const antenna of Object.keys(m.ANTENNAS)) {
  const p={bandwidth,power,modulation,coding,antenna},r=m.assessDesign(p,variant);
  const gain=m.ANTENNAS[antenna].gain;
  const rate=bandwidth*m.MODES[modulation].bits*m.CODINGS[coding].rate*.8*.99;
  const snr=power+2*gain-c.maximumLoss+94-10*Math.log10(bandwidth/5);
  const threshold=m.MODES[modulation].threshold+m.CODINGS[coding].thresholdShift;
  assert.equal(r.feasible,bandwidth<=c.maxBandwidth && power+gain<=c.maxEirp && rate>=c.minRate && snr>=threshold);
  if(r.feasible){accepted.add(JSON.stringify(p));modes.add(modulation);antennas.add(antenna);}
 }
 assert(accepted.size>=90 && accepted.size<=110,`Variant ${variant}: ${accepted.size}`);
 assert(modes.size>=2 && antennas.size>=2);pools.push(accepted);
 assert(!m.assessDesign(m.designDefaults(),variant).feasible);
}
assert(![...pools[0]].some(p=>pools.every(pool=>pool.has(p))));
for(let i=0;i<pools.length;i++)for(let j=i+1;j<pools.length;j++)
 assert([...pools[i]].some(p=>!pools[j].has(p))||[...pools[j]].some(p=>!pools[i].has(p)));
""")


def test_every_trace_matches_selected_passport_and_only_loss_changes_snr():
    run_js("""
for(const variant of Object.keys(m.VARIANTS).map(Number)) {
 const p={bandwidth:5,power:12,antenna:'omni',modulation:'16-QAM',coding:'3/4'};
 const c=m.variantSettings(variant),r=m.design(p,variant),e=m.environment(variant);
 assert(r.legal);assert.equal(r.samples.length,300);assert.deepEqual(r,m.design(p,variant));
 close(Math.min(...e.map(s=>s.loss)),c.minimumLoss);close(Math.max(...e.map(s=>s.loss)),c.maximumLoss);
 close(r.snrRange.minimum,12-c.maximumLoss-r.noise);close(r.snrRange.maximum,12-c.minimumLoss-r.noise);
 close(Math.min(...r.samples.map(s=>s.snr)),r.snrRange.minimum);
 close(Math.max(...r.samples.map(s=>s.snr)),r.snrRange.maximum);
 for(let i=0;i<r.samples.length;i++){
  const s=r.samples[i];close(s.received,12-s.loss);close(s.snr,s.received-r.noise);
  assert.equal(s.supported,s.snr>=r.requiredSnr);assert.equal(s.bler,s.supported?.01:null);
  close(s.rate,s.supported?r.operatingRate:0);assert.equal(s.meets,s.rate>=c.minRate);
  if(i)close(s.snr-r.samples[i-1].snr,-(s.loss-r.samples[i-1].loss));
 }
}
""")


def test_static_assessment_and_trial_have_the_same_decision_and_limits():
    run_js("""
const cases=[m.designDefaults(),{bandwidth:3,power:8,antenna:'dish',modulation:'64-QAM',coding:'3/4'},
 {bandwidth:7,power:8,antenna:'dish',modulation:'16-QAM',coding:'3/4'},
 {bandwidth:20,power:24,antenna:'dish',modulation:'QPSK',coding:'1/2'}];
for(const variant of Object.keys(m.VARIANTS).map(Number))for(const p of cases){
 const a=m.assessDesign(p,variant),r=m.design(p,variant);
 for(const key of Object.keys(a))assert.deepEqual(r[key],a[key]);
 if(!a.legal)assert.deepEqual(r.samples,[]);
 else{close(r.minimumRate,Math.min(...r.samples.map(s=>s.rate)));
  assert.equal(r.feasible,r.checks.bandwidth&&r.checks.eirp&&r.samples.every(s=>s.meets));}
}
const narrow=m.design({bandwidth:6,power:0,antenna:'omni',modulation:'QPSK',coding:'1/2'},1);
assert(!narrow.checks.bandwidth && narrow.checks.eirp && !narrow.legal && !narrow.feasible);
const over=m.design({bandwidth:5,power:20,antenna:'dish',modulation:'QPSK',coding:'1/2'},1);
assert(over.checks.bandwidth && !over.checks.eirp && !over.legal && !over.feasible);
""")


def test_coding_and_bandwidth_change_rate_and_noise_with_fixed_bler_overhead():
    run_js("""
const p={bandwidth:7,modulation:'16-QAM',coding:'2/3',power:13,antenna:'panel'};
const r=m.assessDesign(p,2);close(r.nominalRate,7*4*(2/3)*.8);close(r.operatingRate,r.nominalRate*.99);
close(r.eirp,17);close(r.noise,-94+10*Math.log10(7/5));close(r.requiredSnr,20.5);
close(r.snrRange.minimum,13+2*4-95-r.noise);
for(const [coding,c] of Object.entries(m.CODINGS)){
 const a=m.assessDesign({...p,coding},2);close(a.nominalRate,7*4*c.rate*.8);
 close(a.requiredSnr,22+c.thresholdShift);assert.deepEqual(a.snrRange,r.snrRange);
}
const narrow=m.assessDesign({...p,bandwidth:1},2),wide=m.assessDesign({...p,bandwidth:20},2);
close(wide.noise-narrow.noise,10*Math.log10(20));close(wide.nominalRate/narrow.nominalRate,20);
close(narrow.snrRange.minimum-wide.snrRange.minimum,10*Math.log10(20));
assert(!wide.checks.bandwidth); // The parameter remains selectable, but violates this variant.
""")


def test_calculated_power_interval_produces_working_candidates():
    run_js("""
for(const variant of Object.keys(m.VARIANTS).map(Number)){
 const c=m.variantSettings(variant);let found=false;
 for(const bandwidth of m.DESIGN_OPTIONS.bandwidth)for(const modulation of Object.keys(m.MODES))
 for(const coding of Object.keys(m.CODINGS))for(const antenna of Object.keys(m.ANTENNAS)){
  const gain=m.ANTENNAS[antenna].gain,noise=-94+10*Math.log10(bandwidth/5);
  const rate=bandwidth*m.MODES[modulation].bits*m.CODINGS[coding].rate*.8*.99;
  const threshold=m.MODES[modulation].threshold+m.CODINGS[coding].thresholdShift;
  if(bandwidth>c.maxBandwidth||rate<c.minRate)continue;
  const low=Math.max(0,Math.ceil(noise+threshold+c.maximumLoss-2*gain));
  const high=Math.min(24,c.maxEirp-gain);
  if(low<=high){
   assert(m.design({bandwidth,modulation,coding,antenna,power:low},variant).feasible);
   if(low>0)assert(!m.assessDesign({bandwidth,modulation,coding,antenna,power:low-1},variant).checks.snr);
   found=true;
  }
 }
 assert(found);
}
""")


def test_invalid_variants_and_settings_are_rejected():
    run_js("""
for(const id of [0,9,1.5,'1',null,NaN]){
 assert.throws(()=>m.variantSettings(id),RangeError);
 assert.throws(()=>m.design(m.designDefaults(),id),RangeError);
 assert.throws(()=>m.environment(id),RangeError);
}
for(const bad of [{bandwidth:0},{bandwidth:21},{bandwidth:1.5},{power:25},{power:NaN},
 {antenna:'missing'},{modulation:'256-QAM'},{coding:'1/3'}])
 assert.throws(()=>m.design({...m.designDefaults(),...bad},1),RangeError);
""")
