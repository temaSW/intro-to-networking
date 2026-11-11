"""PCM slot boundaries and Beacon full-reception timing / channel occupancy."""
from pathlib import Path
import subprocess


def test_pcm_beacon_practice_models():
    model = Path(__file__).resolve().parents[1] / 'course/interactives/pcm-beacon-model.js'
    source = r"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PCM,channelSlot,sampleCode,pcmState,beaconPlan,beaconState}=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync(MODEL,'utf8')));
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
assert.equal(PCM.sampleRate*32*8,2048000);
assert.equal(PCM.sampleRate*30*8,1920000);
assert.equal(channelSlot(15),15);assert.equal(channelSlot(16),17);assert.equal(channelSlot(30),31);
const slots=Array.from({length:30},(_,i)=>channelSlot(i+1));
assert.equal(new Set(slots).size,30);assert(!slots.includes(0));assert(!slots.includes(16));
const first=pcmState(0);assert.equal(first.bits,0);assert.equal(first.activeSlot,0);
const service=pcmState(125/32);assert.equal(service.bits,8);assert.equal(service.serviceBits,8);assert.equal(service.speechBits,0);
const last=pcmState(1000);assert.equal(last.bits,2048);assert.equal(last.speechBits,1920);assert.equal(last.serviceBits,128);assert.equal(last.activeSlot,null);assert.equal(last.completedCycles,8);
for(let channel=1;channel<=30;channel++){
 const slot=channelSlot(channel);
 for(let cycle=0;cycle<8;cycle++){
  const code=sampleCode(channel,cycle);assert(Number.isInteger(code)&&code>=0&&code<=255);
  const arrival=cycle*125+(slot+1)*125/32;
  assert(!pcmState(arrival-.0001,channel).received[cycle]);assert(pcmState(arrival,channel).received[cycle]);
 }
 assert(pcmState(1000,channel).received.every(Boolean));
}
for(let bits=0;bits<=2048;bits++){
 const s=pcmState(bits*125/256);assert.equal(s.bits,bits);assert.equal(s.speechBits+s.serviceBits,bits);assert(s.speechBits>=0&&s.serviceBits>=0);
}
for(const period of [100,500]){
 const p=beaconPlan(period);assert.equal(p.wait,period);assert.equal(p.nextStart,period);assert.equal(p.end,period+.5);
 assert(!beaconState(p,period+.499).discovered);assert(beaconState(p,period+.5).discovered);
 assert.equal(beaconState(p,period).stage,'Приём Beacon');
 const done=beaconState(p,1000);assert.equal(done.completed,p.count);assert.equal(done.occupied,p.airtime);assert.equal(done.waited,p.wait);
 close(p.count,period===100?10:2);close(p.airtime,period===100?5:1);
 const exact=beaconPlan(period,period===100?100:0);close(exact.wait,.5);
 const mid=beaconPlan(period,period===100?100.2:.2);assert(mid.nextStart>mid.listen);assert(mid.wait>period-.5);
 for(const listen of [.5,99.9,100,100.2,100.5,499.5]){
  const q=beaconPlan(period,listen);assert(q.nextStart>=listen-1e-8);assert(q.wait>=.5-1e-8&&q.wait<period+.5);
  let prior=0;
  for(let time=0;time<=1000;time+=.1){const s=beaconState(q,time);assert(s.occupied>=prior-1e-7&&s.occupied<=q.airtime+1e-7);prior=s.occupied;assert(s.waited>=0&&s.waited<=q.wait+1e-7);}
 }
}
for(const channel of [0,31,1.5])assert.throws(()=>channelSlot(channel),RangeError);
for(const time of [-1,1001,NaN])assert.throws(()=>pcmState(time),RangeError);
assert.throws(()=>beaconPlan(200),RangeError);
""".replace('MODEL', repr(str(model)))
    result = subprocess.run(['node', '--input-type=module', '-e', source], capture_output=True, text=True, encoding='utf-8')
    assert result.returncode == 0, result.stderr
