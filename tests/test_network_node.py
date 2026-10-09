"""Delivery invariants of the teaching model, independent of its interface."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/network-node-model.js'


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', source], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_content_alone_does_not_reveal_destination():
    run_js("""
assert.deepEqual(m.scene('build','D',0).observable,m.scene('build','E',0).observable);
assert.notDeepEqual(m.scene('build','D',1).observable,m.scene('build','E',1).observable);
assert.equal(m.scene('build','D',2).packet.payload,'Привет');
""")


def test_onward_frames_keep_the_network_addressee_and_content():
    run_js("""
for (const [destination,next,output] of [['D','В',1],['E','Г',2]]) {
  for (let stage=0;stage<5;stage++) {
    const s=m.scene('forward',destination,stage);
    assert.equal(s.packet.destination,destination);
    assert.equal(s.packet.source,'С');
    assert.equal(s.packet.payload,'Привет');
    assert.equal(s.incoming.receiver,'У');
    assert.equal(s.decision.output,output);
    if(stage<3) assert.equal(s.outgoing,null);
    else {
      assert.equal(s.outgoing.sender,'У');
      assert.equal(s.outgoing.receiver,next);
      assert.deepEqual(s.outgoing.packet,s.incoming.packet);
    }
  }
}
""")


def test_local_and_unreachable_packets_never_get_an_onward_frame():
    run_js("""
for (const [destination,action] of [['U','local'],['Z','unreachable']]) {
  const s=m.scene('forward',destination,100);
  assert.equal(s.stage,2);
  assert.equal(s.count,3);
  assert.equal(s.decision.action,action);
  assert.equal(s.outgoing,null);
  assert.equal(s.decision.next,null);
}
""")


def test_scene_changes_do_not_mutate_other_instances():
    run_js("""
const original=m.scene('build','D',0);
const copy=structuredClone(original);
m.scene('forward','E',4);
m.scene('forward','Z',4);
assert.deepEqual(original,copy);
assert.deepEqual(m.scene('build','D',0),copy);
assert.equal(m.scene('forward','D',-10).stage,0);
assert.equal(m.scene('forward','D',100).stage,4);
assert.throws(()=>m.scene('build','U'),RangeError);
assert.throws(()=>m.scene('unknown','D'),RangeError);
""")
