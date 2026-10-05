"""Check loss of alignment and direction/resource invariants of the teaching maps."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / "course/interactives/transmission-frame-model.js"


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
{assertions}
"""
    result = subprocess.run(["node", "--input-type=module", "-e", source],
                            text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_pcm_shift_distinguishes_word_and_channel_alignment():
    run_js("""
const a=m.pcmRead(1,0,0); assert.equal(a.bits,m.pcmSlot(1,0).bits);
const b=m.pcmRead(1,1,0); assert.equal(b.wordAligned,false);
assert.equal(b.bits,m.pcmSlot(1,0).bits.slice(1)+m.pcmSlot(2,0).bits[0]);
const c=m.pcmRead(1,8,0); assert.equal(c.wordAligned,true);
assert.equal(c.aligned,false); assert.equal(c.sourceSlot,2);
const d=m.pcmRead(31,8,15); assert.equal(d.sourceSlot,0);
assert.equal(d.sourceFrame,0); assert.equal(d.bits,m.pcmSlot(0,0).bits);
for(let s=0;s<32;s++) for(let o=0;o<256;o++) assert.equal(m.pcmRead(s,o,0).bits.length,8);
assert.equal(Array.from({length:32},(_,i)=>m.pcmSlot(i).kind).filter(k=>k==='payload').length,30);
assert.equal(m.pcmSlot(0,0).bits.slice(1),'0011011');
assert.equal(m.pcmSlot(0,1).bits[1],'1');
assert.equal(m.pcmSlot(16,0).bits.slice(0,4),'0000');
""")


def test_nr_events_use_available_directions_and_real_frame_dimensions():
    run_js("""
assert.equal(m.NR.slots*m.NR.slotMs,m.NR.frameMs);
for(const phase of m.STAGES) for(const mode of ['fdd','tdd']) {
  for(const event of m.nrEvents(phase.id,mode)) {
    assert(event.slot>=0 && event.slot<20);
    const direction=m.slotDirection(event.slot,mode);
    assert(direction==='both' || direction===event.direction);
    if(event.id==='ssb'||event.id==='control'||event.id==='sib') assert.equal(event.direction,'dl');
    if(event.id==='prach') assert.equal(event.direction,'ul');
  }
}
const r=m.SSB_REGIONS;
assert.equal(r.find(x=>x.id==='pss').end-r.find(x=>x.id==='pss').start,127);
assert.equal(r.find(x=>x.id==='sss').symbol,2);
const pbch=r.filter(x=>x.id==='pbch');
assert.equal(pbch.reduce((n,x)=>n+x.end-x.start,0),576);
const pilots=pbch.reduce((n,x)=>n+Array.from({length:x.end-x.start},(_,i)=>x.start+i).filter(k=>k%4===0).length,0);
assert.equal(pilots,144); assert.equal((576-pilots)*2,864);
""")
