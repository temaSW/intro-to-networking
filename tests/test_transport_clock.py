"""Hand-calculated E1 clock discrepancies and the bounds of the teaching model."""
from pathlib import Path
import subprocess

MODEL=Path(__file__).resolve().parents[1]/'course/interactives/transport-clock-model.js'


def run_js(assertions):
    source=f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync({str(MODEL)!r},'utf8')));
{assertions}
"""
    result=subprocess.run(['node','--input-type=module','-e',source],capture_output=True,text=True)
    assert result.returncode==0,result.stderr


def test_known_source_counts():
    run_js("""
const d=m.clockDrift(25,1000);
assert.equal(d.rateA,2048000);
assert(Math.abs(d.rateB-2048051.2)<1e-6);
assert.equal(d.countA,2048000);
assert.equal(d.countB,2048051);
assert.equal(d.excess,51);
assert.equal(m.clockDrift(50,1000).excess,102);
assert.equal(m.clockDrift(50,500).excess,51);
""")


def test_zero_and_accumulation_at_control_steps():
    run_js("""
for(const ppm of [0,1,25,50]) {
  let previous=0;
  for(let time=0;time<=1000;time+=10) {
    const d=m.clockDrift(ppm,time);
    assert.equal(d.excess,d.countB-d.countA);
    assert(d.excess>=previous);
    assert(d.excess<=110);
    assert(Math.abs(d.excess-2048000*ppm*1e-6*time/1000)<1+1e-7);
    if(ppm===0 || time===0) assert.equal(d.excess,0);
    previous=d.excess;
  }
}
""")


def test_invalid_parameters_and_no_state_leak():
    run_js("""
const first=m.clockDrift(25,1000);
m.clockDrift(50,500);
assert.deepEqual(first,m.clockDrift(25,1000));
for(const args of [[-1,100],[51,100],[1.5,100],[NaN,100],[25,-1],[25,1001],[25,NaN]])
  assert.throws(()=>m.clockDrift(...args),RangeError);
""")
