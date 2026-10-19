"""Conservation, service limits and burst behaviour of the shared-resource model."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/multiplexing-model.js'


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
const base = {{flows:8, activity:25, capacity:4, buffer:48, pattern:'staggered'}};
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', source], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_conservation_capacity_and_finite_buffers():
    run_js("""
for (const flows of [1,8,24]) for (const activity of [0,25,100])
for (const capacity of [1,4,24]) for (const buffer of [0,1,48,240]) {
  const c = {...base, flows, activity, capacity, buffer};
  for (const d of Object.values(m.compare(c))) {
    assert.equal(d.offered, flows * activity * 10);
    assert.equal(d.offered, d.sent + d.lost + d.pending);
    assert(d.sent * m.PACKET_BITS <= capacity * 1e6 + 1e-5);
    assert(d.utilization >= 0 && d.utilization <= 1 + 1e-9);
    assert(d.samples.every(s => s.queue >= 0 && s.queue <= buffer));
    assert(d.wait === null || d.wait >= 0);
  }
}
""")


def test_idle_and_uncontended_analytical_cases():
    run_js("""
const idle = m.compare({...base, activity:0});
for (const d of Object.values(idle)) {
  assert.equal(d.utilization,0); assert.equal(d.wait,null); assert.equal(d.lost,0);
}
const one = m.compare({...base,flows:1,activity:100,capacity:1,buffer:0});
assert.deepEqual(one.dedicated,one.shared);
assert.equal(one.shared.sent,1000);
assert.equal(one.shared.utilization,1);
assert.equal(one.shared.delay,1);
assert.equal(one.shared.wait,0);
""")


def test_shared_resource_handles_staggered_bursts_better():
    run_js("""
const d=m.compare(base);
assert.equal(d.shared.lost,0);
assert(d.shared.delay < d.dedicated.delay);
assert(d.dedicated.lost > 0);
const synced=m.compare({...base,pattern:'synchronous'});
assert(synced.shared.lost > d.shared.lost);
assert(synced.shared.maxQueue > d.shared.maxQueue);
""")


def test_buffer_trades_losses_for_wait_and_does_not_create_capacity():
    run_js("""
const small=m.compare({...base,pattern:'synchronous',buffer:8}).shared;
const large=m.compare({...base,pattern:'synchronous',buffer:240}).shared;
assert(large.lost < small.lost);
assert(large.wait > small.wait);
const overloaded=m.compare({...base,activity:100,capacity:2,buffer:240}).shared;
assert(overloaded.lost > 0);
assert(overloaded.sent <= 2000);
assert(overloaded.pending > 0);
assert(overloaded.utilization > .999);
""")


def test_deterministic_independent_experiments_and_validation():
    run_js("""
const first=m.compare(base), snapshot=structuredClone(first);
m.compare({...base,flows:24,pattern:'synchronous'});
assert.deepEqual(first,snapshot);
assert.deepEqual(m.compare(base),first);
for(const change of [{flows:0},{capacity:0},{activity:101},{buffer:-1},{pattern:'random'}])
  assert.throws(()=>m.compare({...base,...change}),RangeError);
""")


def test_snapshot_conservation_and_service_boundaries():
    run_js("""
for (const pattern of ['staggered','synchronous']) for (const buffer of [0,24]) {
  const config = {...base, flows:4,capacity:2,buffer,pattern};
  for (const result of Object.values(m.compare(config))) {
    for (const t of [0,.25,.5,1,12,24.75,25,99.75,100,999.75,1000]) {
      const s=m.stateAt(result,t);
      assert.equal(s.offered,s.sent+s.waiting.length+s.transmitting.length+s.rejected.length);
      assert(s.waiting.length<=buffer);
      assert(s.transmitting.every(job=>job.start<=t+1e-9 && job.finish>t+1e-9));
    }
    const final=m.stateAt(result,1000);
    assert.equal(final.sent,result.sent);
    assert.equal(final.rejected.length,result.lost);
    assert.equal(final.waiting.length+final.transmitting.length,result.pending);
  }
}
const data=m.compare({...base,flows:1,activity:100,capacity:2,buffer:0}).shared;
assert.equal(m.stateAt(data,0).transmitting.length,1);
assert.equal(m.stateAt(data,.25).transmitting[0].finish,.5);
assert.equal(m.stateAt(data,.5).transmitting.length,0);
assert.equal(m.stateAt(data,.5).sent,1);
assert.equal(m.stateAt(data,1).transmitting.length,1);
for(const t of [-1,1001,NaN]) assert.throws(()=>m.stateAt(data,t),RangeError);
""")


def test_two_packet_story_has_analytical_waiting_interval():
    run_js("""
const config={flows:4,capacity:2,buffer:8};
const trace=[{t:0,source:0,sequence:1},{t:1,source:0,sequence:2}];
const dedicated=m.simulate(config,'dedicated',trace);
const shared=m.simulate(config,'shared',trace);
assert.deepEqual(dedicated.accepted.map(j=>[j.start,j.finish]),[[0,2],[2,4]]);
assert.deepEqual(shared.accepted.map(j=>[j.start,j.finish]),[[0,.5],[1,1.5]]);
assert.equal(m.stateAt(dedicated,1).waiting[0].sequence,2);
assert.equal(m.stateAt(dedicated,1).transmitting[0].sequence,1);
assert.equal(m.stateAt(shared,1).waiting.length,0);
assert.equal(m.stateAt(shared,1).transmitting[0].sequence,2);
assert.equal(m.stateAt(shared,1.5).sent,2);
assert.equal(m.stateAt(dedicated,4).sent,2);
""")
