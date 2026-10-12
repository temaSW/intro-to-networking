"""Band power and the difference between energy and a known system feature."""
from pathlib import Path
import subprocess

MODEL = Path(__file__).resolve().parents[1] / 'course/interactives/frequency-search-model.js'


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
{assertions}
"""
    result = subprocess.run(['node', '--input-type=module', '-e', source], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_band_power_conserves_energy_and_matches_spectral_area():
    run_js("""
for (const s of m.sources) {
  const total=s.peak*s.halfWidth;
  assert(Math.abs(m.bandPower(s,-100,100)-total)<1e-12);
  assert.equal(m.bandPower(s,100,101),0);
  assert(Math.abs(m.bandPower(s,-100,s.center)-total/2)<1e-12);
  for (const c of m.channels) {
    const lo=c.center-m.receiverHalfWidth,hi=c.center+m.receiverHalfWidth;
    const power=m.bandPower(s,lo,hi);
    assert(power>=0 && power<=total+1e-12);
    const n=2000,dx=(hi-lo)/n;
    const integrated=Array.from({length:n},(_,i)=>m.density(s,lo+(i+.5)*dx)*dx).reduce((a,b)=>a+b,0);
    assert(Math.abs(power-integrated)<1e-5);
  }
}
""")


def test_empty_partial_known_and_foreign_transmissions_are_distinct():
    run_js("""
const at=f=>m.observe(m.channels.findIndex(c=>c.center===f));
assert.equal(at(0).energy,false);
assert.deepEqual(at(0).recognized,[]);
assert.equal(at(5).energy,true); // A's edge is inside the band, not its full feature.
assert.deepEqual(at(5).recognized,[]);
assert.equal(at(10).energy,true);
assert.deepEqual(at(10).recognized,['A']);
assert.deepEqual(at(15).recognized,['B']);
assert.deepEqual(at(30).recognized,['C']);
assert.equal(at(45).energy,true); // Strong energy from a foreign system.
assert.deepEqual(at(45).recognized,[]);
assert.equal(at(55).energy,false);
assert.throws(()=>m.observe(-1),RangeError);
assert.throws(()=>m.observe(12),RangeError);
""")
