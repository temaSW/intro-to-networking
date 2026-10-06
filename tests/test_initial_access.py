"""Acquisition, knowledge, contention timeout and exact grant permissions."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'course/interactives/initial-access-model.js'
SHARED = ROOT / 'course/interactives/transmission-agreement-model.js'


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const shared='data:text/javascript;base64,'+fs.readFileSync({str(SHARED)!r}).toString('base64');
const code=fs.readFileSync({str(MODEL)!r},'utf8').replace('./transmission-agreement-model.js',shared);
const {{InitialAccess,Contention,frameObservation,carrierObservation}}=await import('data:text/javascript,'+encodeURIComponent(code));
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', source], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_initial_knowledge_and_frame_hypothesis():
    run_js("""
const p=new InitialAccess(),d=frameObservation();
assert.equal(p.frameTiming,null);assert(!p.carrierKnown);assert(!p.info);
assert.deepEqual(p.knowledge(),['символьный такт']);assert(!p.canUse('common'));
assert.throws(()=>p.readSystemInfo());assert.throws(()=>p.tuneCarrier(25));
assert(!p.locateFrame(0).correct);assert.equal(p.frameTiming,null);
assert(p.locateFrame(d.peak).correct);assert.equal(p.frameTiming,d.peak);
assert(!p.info);assert(!p.checkData().allowed);
assert.throws(()=>p.locateFrame(-1),RangeError);
""")


def test_frequency_accumulation_and_manual_compensation():
    run_js("""
for(const hz of [-25,0,25]){
 const raw=carrierObservation({hz});
 raw.points.forEach(p=>assert(Math.abs(p.phase-2*Math.PI*hz*p.t)<1e-12));
 const corrected=carrierObservation({hz,estimate:hz});
 corrected.points.forEach(p=>{assert.equal(p.correctedPhase,0);assert.deepEqual(p.corrected,[1,0]);});
 assert(Math.abs(carrierObservation({hz,estimate:hz/2}).points.at(-1).correctedPhase)<=Math.abs(raw.points.at(-1).phase));
}
const p=new InitialAccess();p.locateFrame(frameObservation().peak);
p.tuneCarrier(-25);assert(!p.carrierKnown);assert.throws(()=>p.readSystemInfo());
p.tuneCarrier(25);assert(p.carrierKnown);assert(!p.info);p.readSystemInfo();assert(p.info);
assert.throws(()=>p.tuneCarrier(0));assert(p.carrierKnown);
""")


def test_context_service_grant_and_exact_user_grant():
    run_js("""
const p=new InitialAccess();
assert.throws(()=>p.beginAccess());assert.throws(()=>p.identify());assert.throws(()=>p.assignResource());
p.locateFrame(frameObservation().peak);p.tuneCarrier(25);p.readSystemInfo();
assert(p.canUse('common'));assert(!p.canUse('service'));assert(!p.checkData().allowed);
p.beginAccess();assert(p.waiting);assert.equal(p.context,null);assert(!p.canUse('common'));
p.resolveAccess(true);assert(p.context);assert(!p.known);assert(p.canUse('service'));
assert(!p.checkData().allowed);assert.throws(()=>p.transmit('С-A',p.serviceGrant.time));
p.identify();assert(p.known);assert(!p.canUse('common'));assert(!p.checkData().allowed);
p.requestResource();assert(!p.checkData().allowed);p.assignResource();
const g={...p.grant};assert(p.checkData(g.resource,g.time).allowed);
assert.throws(()=>p.transmit());assert.equal(p.queue,1);
for(const [r,t] of [['С-A',g.time],[g.resource,g.time-1],[g.resource,g.time+1]]){
 assert.throws(()=>p.transmit(r,t));assert.equal(p.queue,1);assert.equal(p.sent,0);
}
p.transmit(g.resource,g.time);assert.equal(p.sent,1);assert.equal(p.queue,0);assert.equal(p.grant,null);
assert.throws(()=>p.transmit(g.resource,g.time));
p.reset();assert.equal(p.frameTiming,null);assert.equal(p.sent,0);assert.equal(p.queue,1);
""")


def test_manual_collisions_are_learned_only_after_timeout():
    run_js("""
const c=new Contention();c.attempt([1,1]);
assert.equal(c.events[0].kind,'collision');assert(c.terminals.every(t=>t.status==='waiting'&&!t.context));
assert.throws(()=>c.attempt([0,2]));c.response();assert(c.events.every(e=>e.kind==='timeout'));
assert(c.terminals.every(t=>t.status==='backoff'&&t.retry>=1));
c.reset();c.attempt([0,2]);assert(c.events.every(e=>e.kind==='success'));
assert(c.terminals.every(t=>t.status==='waiting'&&!t.context));c.response();
assert(c.terminals.every(t=>t.context&&t.status==='context'));
const p=new InitialAccess();p.locateFrame(frameObservation().peak);p.tuneCarrier(25);p.readSystemInfo();
p.beginAccess();p.resolveAccess(false);assert(p.timedOut);assert.equal(p.context,null);assert(p.canUse('common'));
""")


def test_random_backoff_separates_retries_and_reset_replays():
    run_js("""
const lock=new Contention({options:1,backoff:0});
for(let i=0;i<12;i++){lock.attempt();assert.equal(lock.events[0].kind,'collision');lock.response();}
assert(lock.terminals.every(t=>!t.context));
const c=new Contention({options:1,backoff:4,seed:7});
const replay=()=>{const log=[];for(let i=0;i<100&&!c.terminals.every(t=>t.context);i++){
 const old=c.terminals.map(t=>({...t}));c.attempt();
 old.forEach((t,id)=>{if(t.retry>c.window||t.context)assert.equal(c.terminals[id].attempts,t.attempts);});
 log.push(JSON.stringify(c.events));c.response();log.push(JSON.stringify(c.events));
}return log;};
const first=replay();assert(c.terminals.every(t=>t.context));c.reset();assert.deepEqual(replay(),first);
const bad=new Contention();assert.throws(()=>bad.attempt([99,1]),RangeError);assert.equal(bad.phase,'access');assert(bad.terminals.every(t=>t.attempts===0));
for(const config of [{terminals:1},{options:0},{backoff:-1}])assert.throws(()=>new Contention(config),RangeError);
""")
