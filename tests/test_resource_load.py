"""Protocol timing, network knowledge, queue conservation and contention."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / "course/interactives/resource-load-model.js"


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {{InitialAccess,State}} = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r},'utf8')));
{assertions}
"""
    result = subprocess.run(["node", "--input-type=module", "-e", source], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_single_terminal_uses_service_grant_before_user_grant_and_exact_time():
    run_js("""
const s=new InitialAccess();
assert.equal(s.terminals[0].state,State.SYNCED);
assert.throws(()=>s.transmit(0),/grant/);
s.step();assert.equal(s.terminals[0].state,State.INFO);
s.inject(0);assert(!s.checkData(0).allowed);
s.step();assert.equal(s.terminals[0].state,State.RESPONSE);
assert(s.network[0].context);assert.equal(s.terminals[0].context,null);assert(!s.network[0].known);
s.step();assert.equal(s.terminals[0].state,State.CONTEXT);
assert.equal(s.terminals[0].serviceGrant,3);assert(!s.canTransmit(0));assert.throws(()=>s.transmit(0),/grant/);
s.step();assert(s.network[0].known);assert(!s.canTransmit(0));assert.equal(s.network[0].reported,0);
s.step();assert.equal(s.network[0].reported,1);assert.equal(s.terminals[0].state,State.REQUESTED);
s.step();assert(s.canTransmit(0));assert(s.checkData(0).allowed);
assert.equal(s.terminals[0].grants[0].tick,6);
assert.throws(()=>s.transmit(0),/exact time/); // grant cannot be used in window 6
s.step();assert.equal(s.terminals[0].sent,1);assert.equal(s.terminals[0].firstService,6);
assert.equal(s.backlog(),0);assert(!s.canTransmit(0));assert.equal(s.slots[6].events[0].kind,'data');
""")


def test_colliders_wait_for_response_timeout_and_random_retry():
    run_js("""
const s=new InitialAccess({terminals:3,opportunities:2,capacity:1});
for(const t of s.terminals)s.inject(t.id);
s.step();s.step({choices:{0:0,1:0,2:1}});
assert.equal(s.metrics.conflicts,1);assert.equal(s.metrics.successes,1);
assert(s.terminals.every(t=>t.state===State.RESPONSE)); // they do not instantly learn the collision
assert(!s.network[0].detected);assert(s.network[2].detected);
s.step();assert.equal(s.terminals[0].state,State.BACKOFF);assert.equal(s.terminals[1].state,State.BACKOFF);
assert.equal(s.terminals[2].state,State.CONTEXT);
assert(s.terminals.slice(0,2).every(t=>t.queue.length===1&&t.retryFrame>0));
for(let i=0;i<400&&!s.terminals.every(t=>t.sent);i++){
 const old=s.terminals.map(t=>({...t}));s.step();
 if(s.phase===1)old.forEach((t,id)=>{if(t.state===State.BACKOFF&&s.frame<t.retryFrame)assert.equal(s.terminals[id].attempts,t.attempts);});
}
assert(s.terminals.every(t=>t.sent===1));assert.equal(s.terminals[2].attempts,1);
assert(s.terminals[0].attempts>1);assert.equal(s.metrics.successes,3);
""")


def test_without_backoff_synchronized_retry_can_remain_in_conflict():
    run_js("""
const s=new InitialAccess({terminals:2,opportunities:1,backoff:0});s.inject(0);s.inject(1);
for(let i=0;i<70;i++)s.step();
assert.equal(s.metrics.conflicts,10);assert.equal(s.metrics.successes,0);
assert.equal(s.metrics.delivered,0);assert.equal(s.backlog(),2);
assert(s.terminals.every(t=>t.attempts===10));
""")


def test_resource_is_exclusive_fair_and_allocated_from_reported_queue():
    run_js("""
for(const capacity of [0,1,2,8]){
 const s=new InitialAccess({terminals:8,opportunities:4,capacity,arrival:1,continuous:true,seed:91});
 for(let i=0;i<1400;i++){
  s.step();assert.equal(s.metrics.arrivals-s.metrics.delivered,s.backlog());
  const grants=s.terminals.flatMap(t=>t.grants.map(g=>({id:t.id,...g})));
  assert.equal(grants.length,new Set(grants.map(g=>g.cell)).size);assert(grants.length<=capacity);
  for(const g of grants){assert(s.network[g.id].known);assert.equal(g.tick,s.tick+1);assert(g.cell<capacity);}
  const transfers=s.events.filter(e=>e.kind==='data');assert.equal(transfers.length,new Set(transfers.map(e=>e.resource)).size);
 }
 assert.equal(s.metrics.successes,8);
 if(capacity){assert(s.terminals.every(t=>t.sent>1));assert(s.summary().utilization<=1);}
 else{assert.equal(s.metrics.delivered,0);assert.equal(s.summary().meanGrantDelay,null);}
}
const s=new InitialAccess({capacity:8});s.step();s.inject(0);s.step();s.step();s.step();s.step();
assert.equal(s.network[0].reported,1);s.inject(0,4);assert.equal(s.network[0].reported,1);
s.step();assert.equal(s.terminals[0].grants.length,1); // scheduler does not see unreported arrivals
""")


def test_continuous_arrivals_accumulate_while_terminal_is_busy():
    run_js("""
const overloaded=new InitialAccess({terminals:4,opportunities:4,capacity:1,arrival:1,continuous:true});
for(let i=0;i<700;i++)overloaded.step();
assert(overloaded.backlog()>=300);assert.equal(overloaded.metrics.arrivals,400);
assert(overloaded.samples.at(-1).queue>overloaded.samples[10].queue);
const quiet=new InitialAccess({arrival:0,continuous:true});for(let i=0;i<70;i++)quiet.step();
assert.equal(quiet.metrics.attempts,0);assert.equal(quiet.backlog(),0);
""")


def test_reset_reproduces_timed_events_and_invalid_choices_are_atomic():
    run_js("""
const s=new InitialAccess({terminals:4,opportunities:2,arrival:.6,continuous:true,seed:123});
for(let i=0;i<140;i++)s.step();const first=JSON.stringify({t:s.terminals,m:s.metrics,slots:s.slots});
s.reset();assert.equal(s.tick,-1);assert.equal(s.log.length,0);assert.equal(s.backlog(),0);
assert(s.terminals.every(t=>t.state===State.SYNCED&&!t.info&&t.context===null&&!t.grants.length));
for(let i=0;i<140;i++)s.step();assert.equal(JSON.stringify({t:s.terminals,m:s.metrics,slots:s.slots}),first);
const before=s.tick;assert.throws(()=>s.step({choices:{0:99}}),RangeError);assert.equal(s.tick,before);
for(const p of [{terminals:0},{capacity:-1},{opportunities:0},{arrival:2}])assert.throws(()=>new InitialAccess(p),RangeError);
""")

