"""Check form routing and URL refresh without sending responses or creating Issues.

Never put secrets in fixtures, source, diagnostics, or build artifacts.
"""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_feedback_url_lifecycle():
    script = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const forms = [
  ['1FAIpQLScbsWOaqw31Cs30H-o3cjq4DoBKEsViXSzSD4I5BL1WjgEKfg', '2027801067'],
  ['1FAIpQLSc70niaI42Az7F9qNkiEeF9JAoNoPknDjI07u4-hGrBYuqM-Q', '614899729'],
  ['1FAIpQLSeF4BRW5MGA_C1SvuoBoP2nhr4O8fRkI7xRpUPRTcFhe3KEXA', '633006356'],
];
const config = fs.readFileSync('course/_quarto.yml', 'utf8');
const links = forms.map(([id]) => ({
  href: `https://docs.google.com/forms/d/e/${id}/viewform`,
  events: {},
  querySelector: () => ({setAttribute: () => {}}),
  addEventListener(event, callback) { this.events[event] = callback; },
}));
for (const link of links) assert.ok(config.includes(`href: ${link.href}`));
assert.equal((config.match(/target: _blank/g) || []).length, 3);
assert.equal((config.match(/rel: noopener noreferrer/g) || []).length, 3);
const window = {location: {href: 'https://temasw.github.io/intro-to-networking/lectures/index.html?x=1&text=%D1%82#начало'},
  events: {}, addEventListener(event, callback) { this.events[event] = callback; }};
const document = {addEventListener(event, callback) { callback(); },
  querySelectorAll: () => links, querySelector: () => null};
const source = fs.readFileSync('course/_includes/navigation.html', 'utf8')
  .replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
vm.runInNewContext(source, {document, window, URL});
function check() {
  links.forEach((link, i) => {
    const url = new URL(link.href);
    assert.equal(url.pathname, `/forms/d/e/${forms[i][0]}/viewform`);
    assert.equal(url.searchParams.get('usp'), 'pp_url');
    assert.equal(url.searchParams.get(`entry.${forms[i][1]}`), window.location.href);
    assert.equal([...url.searchParams.keys()].length, 2);
  });
}
check();
for (const event of ['hashchange', 'popstate', 'pageshow']) {
  window.location.href += `-${event}`;
  window.events[event](); check();
}
for (const event of ['click', 'auxclick', 'pointerdown', 'mousedown', 'contextmenu', 'focus']) {
  // pushState/replaceState may change the URL without firing popstate.
  window.location.href = `https://temasw.github.io/intro-to-networking/?query=${event}#new`;
  links.forEach(link => link.events[event]()); check();
}
"""
    result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
