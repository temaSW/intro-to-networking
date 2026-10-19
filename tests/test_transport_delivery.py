"""End-to-end outcomes, loss recovery and bounded receive flow."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/transport-delivery-model.js'


def test_delivery_faults_and_flow_control():
    source = r"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync(MODEL,'utf8')));
const trace=(protocol,fault,reader='normal')=>{
  let s=m.start(protocol,fault,reader); const states=[s];
  for(let n=0;!s.done && n<100;n++) {
    const before=structuredClone(s); const next=m.step(s);
    assert.deepEqual(s,before,'a step must preserve the previous snapshot');
    s=next;states.push(s);
    assert(s.buffer.length*4<=m.CAPACITY);
    if(protocol==='tcp') {
      assert(m.BLOCKS.join('').startsWith(s.output.join('')),'only a contiguous prefix reaches the application');
      assert(s.sent*4<=s.edge,'new data must respect the advertised right edge');
      assert(s.next>=s.read); assert(s.ack<=s.next);
      assert.equal(new Set(s.buffer.map(b=>b.index)).size,s.buffer.length);
    }
  }
  assert(s.done,'finite experiment must finish'); assert.equal(m.step(s),s);
  return {s,states};
};
for(const reader of ['normal','slow']) for(const fault of ['none','loss','reorder','delay','duplicate']) {
  const {s}=trace('tcp',fault,reader);
  assert.equal(s.output.join(''),m.BLOCKS.join(''));
}
const normal=trace('tcp','none'); const lost=trace('tcp','loss');
assert(lost.s.time>normal.s.time);
assert(lost.s.history.some(e=>e.message.includes('Повтор')));
assert(lost.states.some(s=>s.next===4 && s.buffer.some(b=>b.index===2) && !s.output.join('').includes('IJKL')));
assert.deepEqual(trace('udp','none').s.output,m.BLOCKS);
assert.deepEqual(trace('udp','loss').s.output,['ABCD','IJKL','MNOP','QRST']);
assert.deepEqual(trace('udp','reorder').s.output,['ABCD','IJKL','EFGH','MNOP','QRST']);
assert.equal(trace('udp','duplicate').s.output.filter(t=>t==='IJKL').length,2);
const slow=trace('tcp','none','slow');
assert(slow.states.some(s=>s.buffer.length*4===m.CAPACITY));
assert(slow.s.history.some(e=>e.message.includes('приостановлена')));
assert(slow.states.some(s=>s.ack>s.read),'ACK need not mean application consumption');
assert(trace('udp','none','slow').s.history.some(e=>e.message.includes('отброшена')));
const chat=m.start('udp','none','normal','chat');
assert.equal(chat.sourcePort,52000);assert.equal(chat.destinationPort,9000);
for(const args of [['bad'],['tcp','bad'],['tcp','none','bad']]) assert.throws(()=>m.start(...args),RangeError);
""".replace('MODEL', repr(str(MODEL)))
    result=subprocess.run(['node','--input-type=module','-e',source],capture_output=True,text=True,encoding='utf-8')
    assert result.returncode == 0, result.stderr
