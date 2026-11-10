import assert from 'node:assert/strict';
import {checkBeaconPeriod,checkFilePlan,checkAccessTime,checkAccessIntervals,checkDirectionalAllocation} from '../course/interactives/topic04-two-tasks-model.js';
assert(checkBeaconPeriod(40).pass);assert(checkBeaconPeriod(98).pass);
assert(!checkBeaconPeriod(39.999).resourcePass);assert(!checkBeaconPeriod(98.001).delayPass);
assert.equal(checkBeaconPeriod(80).worstDelay,82);assert.equal(checkBeaconPeriod(80).servicePercent,2.5);
assert(checkBeaconPeriod(10).delayPass);assert(!checkBeaconPeriod(10).resourcePass);
assert(!checkBeaconPeriod(100).delayPass);assert(checkBeaconPeriod(100).resourcePass);
for(const p of [NaN,Infinity,0,1,201])assert.throws(()=>checkBeaconPeriod(p),RangeError);
let count=0;
for(let bytes=1;bytes<250;bytes++)for(const reverse of [false,true]){
 const plan=[{bytes,start:reverse?466:464},{bytes:250-bytes,start:reverse?464:466}],before=structuredClone(plan),r=checkFilePlan(plan);
 assert.deepEqual(plan,before);assert.equal(r.capacity,128);assert.deepEqual(r.slots,[{id:3,start:464,end:466},{id:4,start:466,end:468}]);
 assert.equal(r.pass,bytes>=122&&bytes<=128);assert.equal(r.maxBytes,256);assert.equal(r.minimumRemaining,0);
 const late=checkFilePlan(plan,465);assert(!late.pass);assert.equal(late.maxBytes,128);assert.equal(late.minimumRemaining,122);
 assert(late.deliveredBytes<=128);count++;
}
let r=checkFilePlan([{bytes:122,start:464},{bytes:128,start:466}],465);assert.equal(r.deliveredBytes,128);assert.equal(r.remainingBytes,122);
r=checkFilePlan([{bytes:125,start:464},{bytes:125,start:466}],465);assert.equal(r.deliveredBytes,125);assert.equal(r.remainingBytes,125);
r=checkFilePlan([{bytes:125,start:466},{bytes:125,start:466}]);assert(!r.pass);assert.equal(r.deliveredBytes,0);assert(r.rows.every(row=>row.issues.some(s=>s.includes('перекрываются'))));
r=checkFilePlan([{bytes:125,start:463.5},{bytes:125,start:466}]);assert(!r.pass);assert.equal(r.deliveredBytes,125);
r=checkFilePlan([{bytes:128,start:464},{bytes:128,start:466}]);assert(!r.totalPass);assert.equal(r.deliveredBytes,null);
assert.throws(()=>checkFilePlan([{bytes:1.5,start:464},{bytes:248.5,start:466}]),RangeError);
assert.throws(()=>checkFilePlan([{bytes:125,start:464},{bytes:125,start:466}],464),RangeError);
console.log(`PASS: beacon bounds 40–98 ms; ${count} packet splits/orderings, capacity, exact intervals, late readiness, overlap and unchanged inputs`);

for(let i=0;i<=400;i++){
 const start=i/4,r=checkAccessTime(start);assert.equal(r.pass,start>=48&&start<=49);assert.equal(r.end,start+2);
}
assert(checkAccessTime(49).deadlinePass);assert(!checkAccessTime(49.25).deadlinePass);
assert(!checkAccessTime(31).window);assert(checkAccessTime(30).window);assert(!checkAccessTime(30).readyPass);
for(const count of [1,2,3,4,5,6,7,8]){
 const r=checkAccessIntervals(count);assert.equal(r.pairs.length,count*count);assert.equal(r.collisions,count);assert.equal(r.probability,1/count);assert.equal(r.reservedMs,2*count);assert.equal(r.pass,count===3);
 assert(r.pairs.every(p=>p.collision===(p.a===p.b)));
}
assert.throws(()=>checkAccessIntervals(2.5),RangeError);assert.throws(()=>checkAccessTime(NaN),RangeError);
let allocations=0;
for(const um of ['M1','M2'])for(const dm of ['M1','M2'])for(let uc=1;uc<=8;uc++)for(let dc=1;dc<=8;dc++){
 const up={mode:um,cells:uc},down={mode:dm,cells:dc},before=JSON.stringify([up,down]),r=checkDirectionalAllocation(up,down);
 assert.equal(JSON.stringify([up,down]),before);assert.equal(r.up.feasible,um==='M1'&&uc>=3);assert.equal(r.down.feasible,dm==='M1'?dc>=3:dc>=2);
 assert.equal(r.pass,um==='M1'&&uc===3&&dm==='M2'&&dc===2);
 assert.equal(r.up.minimumCells,3);assert.equal(r.down.minimumCells,2);
 for(const d of [r.up,r.down]){assert.equal(d.fills.reduce((a,b)=>a+b,0),Math.min(250,d.capacity));assert(d.fills.every(b=>b>=0&&b<=d.bytesPerCell));}
 allocations++;
}
assert.throws(()=>checkDirectionalAllocation({mode:'__proto__',cells:2},{mode:'M2',cells:2}),RangeError);
console.log(`PASS: 401 access times, exact enumeration of random access, ${allocations} directional allocations, feasible vs minimum-resource distinction`);
