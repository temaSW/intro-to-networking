"""Path delay, bottleneck migration and a bounded finite FIFO under deterministic load."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/path-performance-model.js'


def test_path_performance_and_queue_boundaries():
    source=r"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync(MODEL,'utf8')));
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const c={...m.DEFAULTS}; const before=structuredClone(c);
let a=m.evaluate(c), b=m.evaluate(c,'B');
assert.deepEqual(c,before);
close(a.tx,1.092);close(a.propagation,5.36);close(a.processing,.2);close(a.total,6.652);
close(b.tx,.792);close(b.propagation,10.61);close(b.total,11.652);
assert.equal(a.raw,20);assert.equal(b.raw,40);assert(a.total<b.total);
const fast=m.evaluate({...c,access:1000});assert.equal(fast.available,20);close(a.total-fast.total,.108);
const upgraded=m.evaluate({...c,aggregation:100});assert.equal(upgraded.available,50);assert.deepEqual(upgraded.bottlenecks,['Внешняя сеть']);
const doubledDistance=m.evaluate({...c,distance:2000});close(doubledDistance.tx,a.tx);close(doubledDistance.propagation-a.propagation,5);
const small=m.evaluate({...c,bytes:750});close(small.tx,a.tx/2);close(small.propagation,a.propagation);
const loadA=m.evaluate({...c,load:80}),loadB=m.evaluate({...c,load:80},'B');
close(loadA.available,4);close(loadB.available,24);close(loadA.background,loadB.background);
assert.equal(m.evaluate({...c,load:100}).available,0);
const moderate=m.evaluate({...c,aggregation:100,access:1000,load:70});
assert.deepEqual(moderate.bottlenecks,['Агрегация']);close(moderate.available,30);
// Equal average rates need not imply equal delays or losses under different arrival patterns.
const uniform=m.queue(100,1500,80,'steady'),bursts=m.queue(100,1500,80,'burst');
assert(bursts.maxQueue>uniform.maxQueue);assert(bursts.lost>uniform.lost);
const overloaded=m.queue(20,1500,30,'steady');assert(overloaded.lost>0);assert.equal(overloaded.maxQueue,m.BUFFER);
const q=m.queue(20,1500,0,'steady');assert.equal(q.offered,1);assert.equal(q.probe.wait,0);assert.equal(q.lost,0);
let dropped=false;
for(const access of [10,1000]) for(const aggregation of [10,200]) for(const distance of [10,20000])
for(const bytes of [64,1500]) for(const load of [0,150]) for(const pattern of ['steady','burst']) for(const variant of ['A','B']) {
 const r=m.evaluate({access,aggregation,distance,bytes,load,pattern},variant),q=r.queue;
 assert.equal(q.offered,q.accepted+q.lost);assert(q.maxQueue<=m.BUFFER);assert(q.maxQueue>=0);
 assert(q.samples.every(s=>s.queue>=0 && s.queue<=m.BUFFER));assert.equal(q.samples.length,101);
 assert(q.samples.every((s,i)=>s.time===i));
 assert(Number.isFinite(r.tx+r.propagation+r.processing));
 assert(r.available>=0 && r.available<=r.raw);
 if(q.probe.lost) {assert.equal(r.total,null);dropped=true;} else {assert(r.total>=r.tx+r.propagation+r.processing);assert(r.waiting>=0);}
}
assert(dropped,'some high-load probes must be lost, rather than shown with finite end-to-end delay');
for(const patch of [{access:0},{aggregation:201},{distance:NaN},{bytes:1501},{bytes:64.5},{load:151},{pattern:'random'}])
 assert.throws(()=>m.evaluate({...c,...patch}),RangeError);
assert.throws(()=>m.evaluate(c,'C'),RangeError);
""".replace('MODEL',repr(str(MODEL)))
    result=subprocess.run(['node','--input-type=module','-e',source],capture_output=True,text=True,encoding='utf-8')
    assert result.returncode==0,result.stderr
