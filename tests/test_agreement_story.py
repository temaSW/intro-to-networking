"""Semantic boundaries of the terminal's access story, independent of its UI."""
from pathlib import Path
import subprocess


MODEL = Path(__file__).resolve().parents[1] / "course/interactives/agreement-timeline-model.js"


def run_js(assertions):
    source = f"""
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync({str(MODEL)!r}, 'utf8')));
{assertions}
"""
    result = subprocess.run(["node", "--input-type=module", "-e", source], text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_user_data_requires_an_assignment_and_is_not_an_initial_request():
    run_js("""
assert(m.terminalStates.slice(0, 6).every(s => s.events.every(e => e[0] !== 'data')));
const sent = m.terminalStateView(6);
assert.equal(sent.previous.anchor, 'link-frame');
assert(sent.current.events.some(([kind, direction]) => kind === 'data' && direction === 'up'));
assert(sent.current.events.some(([, direction]) => direction === 'ap'));
""")


def test_state_selection_is_local_and_rejects_nonexistent_states():
    run_js("""
const before = JSON.stringify(m.terminalStates);
for (let i = 0; i < m.terminalStates.length; i++) {
  const view = m.terminalStateView(i);
  assert.equal(view.index, i);
  assert.equal(view.current, m.terminalStates[i]);
  assert.equal(view.previous, i ? m.terminalStates[i - 1] : null);
  for (const [, direction] of view.current.events) assert(['up','down','terminal','ap'].includes(direction));
}
assert.equal(JSON.stringify(m.terminalStates), before);
for (const i of [-1, 7, 0.5, NaN, '1']) assert.throws(() => m.terminalStateView(i), RangeError);
""")


def test_every_state_points_to_an_existing_lecture_question():
    lecture = MODEL.parents[1] / "lectures/transmission-agreement.qmd"
    text = lecture.read_text(encoding="utf-8")
    run_js(f"""
const text = {text!r};
assert.equal(new Set(m.terminalStates.map(s => s.anchor)).size, m.terminalStates.length);
for (const state of m.terminalStates) assert(text.includes('{{#' + state.anchor + '}}'));
""")
