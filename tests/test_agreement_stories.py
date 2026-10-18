"""Causal checks for access retries and the lifetime of resource grants."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/agreement-stories-model.js'


def run_js(assertions):
    script = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', script], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_only_unsuccessful_terminals_retry_and_independence_does_not_guarantee_success():
    run_js("""
const outcomes = new Set();
const windows = [new Set(), new Set()];
for(let seed=1; seed<=100; seed++) {
  for(const mode of ['same','independent']) {
    for(let stage=0; stage<=5; stage++) {
      const d=m.accessStory({stage,mode,seed}), c=d.devices[2];
      assert.equal(c.retryWindow,null);
      if(stage>=2) assert.equal(c.status,'accepted');
      if(stage<3) assert.equal(d.waits,null);
      if(stage<5) assert.equal(d.retryResult,null);
      if(stage===5) {
        if(mode==='same') assert.equal(d.retryResult,'collision');
        else {outcomes.add(d.retryResult); d.waits.forEach((v,i)=>windows[i].add(v));}
        assert.equal(d.retryResult==='collision',d.waits[0]===d.waits[1]);
        assert(d.waits.every(w=>w>=1&&w<=3));
      }
    }
  }
}
assert.deepEqual([...outcomes].sort(),['accepted','collision']);
windows.forEach(values=>assert.deepEqual([...values].sort(),[1,2,3]));
assert.deepEqual(m.accessStory({stage:5,mode:'independent',seed:27}),m.accessStory({stage:5,mode:'independent',seed:27}));
""")


def test_requests_change_node_knowledge_but_do_not_authorize_transmission():
    run_js("""
const arrival=m.resourceStory({stage:1});
assert.equal(arrival.queue,6); assert.equal(arrival.nodeQueue,2);
const delivered=m.resourceStory({stage:2});
assert.equal(delivered.nodeQueue,6); assert.equal(delivered.allowed,0);
const lost=m.resourceStory({stage:2,mode:'request-lost'});
assert.equal(lost.queue,6); assert.equal(lost.nodeQueue,2);
const finish=m.resourceStory({stage:5,mode:'request-lost'});
assert.equal(finish.planned,2); assert.equal(finish.transmitted,2);
assert.equal(finish.queue,4); assert.equal(finish.nodeQueue,0);
""")


def test_data_require_a_received_grant_in_its_frame_and_are_conserved():
    run_js("""
for(const mode of ['normal','request-lost','grant-lost','expired']) {
  for(let stage=0; stage<=6; stage++) {
    const d=m.resourceStory({stage,mode});
    assert.equal(d.queue+d.transmitted,stage===0?2:6);
    assert(d.transmitted<=d.received&&d.received<=d.planned&&d.planned<=4);
    assert.equal(d.resource.filter(v=>v==='other').length,2);
    assert.equal(d.resource.filter(v=>v==='sent').length,d.transmitted);
    if(stage<5) assert.equal(d.transmitted,0);
    if(stage!==5) assert.equal(d.allowed,0);
    if(mode==='grant-lost') assert.equal(d.received,0);
    if(mode==='grant-lost'||mode==='expired') assert.equal(d.transmitted,0);
    if(stage===6) assert.equal(d.frame,12);
  }
}
assert.equal(m.resourceStory({stage:5}).transmitted,4);
assert.equal(m.resourceStory({stage:6}).queue,2);
assert.equal(m.resourceStory({stage:6,mode:'expired'}).queue,6);
assert.throws(()=>m.resourceStory({stage:7}),RangeError);
assert.throws(()=>m.resourceStory({mode:'unknown'}),RangeError);
assert.throws(()=>m.accessStory({seed:0}),RangeError);
""")
