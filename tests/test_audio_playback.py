"""Verify the actual Web Audio scheduling methods with a deterministic clock."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_mode_switch_crossfade_and_pause_keep_loop_position():
    script = r"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = './course/interactives/audio-channel-coding/';
const utilities = 'data:text/javascript,' + encodeURIComponent(fs.readFileSync(base+'model.js','utf8'));
const ui = fs.readFileSync(base+'ui.js','utf8').replace("'./model.js'",JSON.stringify(utilities));
globalThis.document = {querySelectorAll:()=>[]};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const {AudioChannelDemo} = await import('data:text/javascript,'+encodeURIComponent(ui));
const button = {setAttribute:()=>{}};
const starts=[], stops=[], ramps=[];
const context = {
  currentTime:12, destination:{}, resume:async()=>{},
  createBuffer:()=>({copyToChannel:()=>{}}),
  createBufferSource:()=>({connect:()=>({connect:()=>{}}), start:(...args)=>starts.push(args),
    stop:time=>stops.push(time), disconnect:()=>{}}),
  createGain:()=>({gain:{setValueAtTime:()=>{},linearRampToValueAtTime:(value,time)=>ramps.push([value,time]),
    cancelAndHoldAtTime:()=>{}},connect:()=>{},disconnect:()=>{}})
};
const demo=Object.assign(Object.create(AudioChannelDemo.prototype), {
  context, voices:new Set(), buffers:new Map(), manifest:{duration:4,samples:4,sample_rate:8000},
  packs:{analog:[new Float32Array(4)], digital:[new Float32Array(4)]},
  offset:1,startedAt:10,playing:true,mode:'analog',index:0,
  playButton:button,status:{},root:{querySelector:()=>({})},draw:()=>{}
});
demo.switchVoice();
assert.deepEqual(starts[0],[12,3]);
assert([...demo.voices][0].source.loop);
demo.mode='digital'; context.currentTime=12.2; demo.switchVoice();
assert(Math.abs(starts[1][1]-3.2)<1e-9); // changing mode does not reset the loop
assert(Math.abs(stops[0]-12.235)<1e-9);
assert(ramps.some(([v,t])=>v===0 && Math.abs(t-12.235)<1e-9));
context.currentTime=12.3; await demo.toggle();
assert.equal(demo.playing,false); assert(Math.abs(demo.offset-3.3)<1e-9);
context.currentTime=50; await demo.toggle();
assert.equal(demo.playing,true); assert(Math.abs(starts[2][1]-3.3)<1e-9);
assert.equal(starts[2][0],50); // paused wall time does not advance audio position
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
