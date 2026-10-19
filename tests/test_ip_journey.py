"""Prefix selection and packet lifetime across complete forwarding paths."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/ip-journey-model.js'


def test_forwarding_paths_and_address_boundaries():
    source = """
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(MODEL, 'utf8')));
const routes = [
 {prefix:'0.0.0.0/0', next:'default'}, {prefix:'10.0.0.0/8', next:'a'},
 {prefix:'10.20.0.0/16', next:'b'}, {prefix:'10.20.30.0/24', next:'c'}];
assert.equal(m.lookup('10.20.30.40',routes).selected.next,'c');
assert.equal(m.lookup('10.20.31.40',routes.toReversed()).selected.next,'b');
assert.equal(m.lookup('203.0.113.20',routes).selected.next,'default');
for (const [addr,expected] of [['192.0.2.127',false],['192.0.2.128',true],['192.0.2.191',true],['192.0.2.192',false]])
 assert.equal(m.matches(addr,'192.0.2.128/26'),expected);
assert(m.matches('2001:db8:0:1::20','2001:db8:0:1::/64'));
assert(!m.matches('2001:db8:0:2::20','2001:db8:0:1::/64'));
assert(m.matches('::1','::/0'));
assert(!m.matches('192.0.2.1','::/0'));
for (const invalid of ['999.0.0.1','1.2.3','1::2::3','2001:db8:::1','<script>']) assert.throws(()=>m.address(invalid),RangeError);
assert.throws(()=>m.matches('1.2.3.4','0.0.0.0/33'),RangeError);
const travel = (dest,ttl,scenario) => {
 let s=m.start(dest,ttl,scenario);
 for(let i=0;s.status==='active' && i<300;i++) {
  const old=structuredClone(s), next=m.forward(s);
  assert.deepEqual(s,old); // each step preserves prior observations
  assert.equal(next.source,m.SOURCE); assert.equal(next.destination,dest);
  s=next;
 }
 return s;
};
let s=travel(m.DESTINATIONS[0],64,'normal');
assert.equal(s.status,'delivered'); assert.equal(s.limit,62);
assert.deepEqual(s.history.map(h=>h.node),['R1','R2']);
assert.deepEqual(s.history.map(h=>h.outgoing.link),['Ethernet по меди','Ethernet по волокну']);
assert.equal(s.history[0].matching.length,3);
s=travel(m.DESTINATIONS[0],4,'default');
assert.equal(s.status,'delivered'); assert.equal(s.limit,1);
assert.deepEqual(s.history.map(h=>h.node),['R1','R3','R2']);
assert.equal(s.history[0].selected.prefix,'0.0.0.0/0');
s=travel(m.DESTINATIONS[0],3,'default');
assert.equal(s.status,'expired'); assert.equal(s.history.at(-1).outgoing,null);
s=travel(m.DESTINATIONS[1],64,'missing');
assert.equal(s.status,'unreachable'); assert.equal(s.history[0].outgoing,null);
s=travel(m.DESTINATIONS[2],64,'normal');
assert.equal(s.status,'unreachable'); assert.equal(s.node,'R3');
s=travel(m.DESTINATIONS[0],4,'loop');
assert.equal(s.status,'expired'); assert.equal(s.limit,0); assert.equal(s.history.length,4);
assert.deepEqual(s.history.map(h=>h.node),['R1','R2','R1','R2']);
assert.equal(m.forward(s),s);
for(const ttl of [0,256,1.5,NaN]) assert.throws(()=>m.start(m.DESTINATIONS[0],ttl),RangeError);
assert.equal(travel(m.DESTINATIONS[1],64,'normal').status,'delivered');
""".replace('MODEL', repr(str(MODEL)))
    result = subprocess.run(['node', '--input-type=module', '-e', source], capture_output=True, text=True, encoding='utf-8')
    assert result.returncode == 0, result.stderr
