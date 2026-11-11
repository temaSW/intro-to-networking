"""MAC byte accounting and event ordering for the Ethernet practice animation."""
from pathlib import Path
import subprocess


def test_ethernet_delivery_timing():
    model = Path(__file__).resolve().parents[1] / 'course/interactives/ethernet-practice-model.js'
    source = r"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {compare,snapshot}=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync(MODEL,'utf8')));
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let [a,b]=compare();
assert.equal(a.wireBytes,1518);assert.equal(b.wireBytes,1770);
close(a.end,1.4144);close(b.end,1.616);
assert.equal(snapshot(a,a.end-0.0001).received,0);
assert.equal(snapshot(a,a.end).received,1500);
assert.equal(snapshot(b,b.frames[0].arrival).received,100);
[a,b]=compare({error:true});
assert.equal(a.wireBytes,3036);assert.equal(b.wireBytes,1888);
assert.equal(a.retryBytes,1518);assert.equal(b.retryBytes,118);
close(a.end,3.6288);close(b.end,2.0496);
assert.equal(snapshot(a,a.initialEnd).received,0);
assert.equal(snapshot(b,b.initialEnd).received,1400);
assert(!snapshot(b,b.initialEnd).accepted.has(7));
assert.equal(snapshot(b,b.end).received,1500);assert(b.end<a.end);
for(const rate of [10,100,1000])for(const propagation of [0,.005,.2,1])for(const recovery of [0,.6,2])for(const error of [false,true]){
 for(const lane of compare({rate,propagation,recovery,error})){
  close(lane.phases.reduce((s,p)=>s+p.end-p.start,0),lane.end);
  close(snapshot(lane,lane.end).sent,lane.wireBytes);
  assert.equal(snapshot(lane,lane.end).received,1500);
  assert.equal(snapshot(lane,0).received,0);
  if(error){assert(lane.retryStart>=lane.initialTx);assert(lane.retryStart>=lane.feedbackEnd);assert(lane.retryStart>=lane.frames[lane.bad].arrival);}
  let previous=0;
  for(let i=0;i<=100;i++){const s=snapshot(lane,lane.end*i/100);assert(s.received>=previous&&s.received<=1500);previous=s.received;}
 }
}
for(const patch of [{rate:0},{propagation:-1},{recovery:NaN},{error:1}])assert.throws(()=>compare(patch),RangeError);
""".replace('MODEL', repr(str(model)))
    result = subprocess.run(['node', '--input-type=module', '-e', source], capture_output=True, text=True, encoding='utf-8')
    assert result.returncode == 0, result.stderr
