"""Build the lecture-04 calculation worksheet as standalone HTML, without dependencies."""
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]


def build(output: Path) -> None:
    fragment = (ROOT / 'course/_includes/topic04-two-tasks.html').read_text(encoding='utf-8')
    css = (ROOT / 'course/styles/topic04-two-tasks.css').read_text(encoding='utf-8')
    model = (ROOT / 'course/interactives/topic04-two-tasks-model.js').read_text(encoding='utf-8').replace('export ', '')
    ui = re.sub(r'^import [^\n]+\n', '', (ROOT / 'course/interactives/topic04-two-tasks-ui.js').read_text(encoding='utf-8'))
    light = '--page-bg:#f8faf9;--surface:#fff;--surface-alt:#f0f5f4;--ink:#183037;--muted:#486067;--line:#c8d8d8;--accent:#075c67;--accent-soft:#e3f1ef;--focus:#a84b12;'
    dark = '--page-bg:#101b20;--surface:#182830;--surface-alt:#20353c;--ink:#ecf4f1;--muted:#bfd0d0;--line:#49676c;--accent:#91dce0;--accent-soft:#21464c;--focus:#ffc178;'
    page = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Расчётные задачи по теме 04 -- ОПИСиС</title><style>
:root{{{light}}}:root[data-theme="dark"]{{{dark}}}@media(prefers-color-scheme:dark){{:root:not([data-theme="light"]){{{dark}}}}}body{{margin:0;background:var(--page-bg);color:var(--ink);font:1rem/1.54 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;}}main{{width:88%;max-width:1100px;margin:1.5rem auto 3rem;}}h1{{font-size:clamp(1.95rem,3vw,2.7rem);line-height:1.2;letter-spacing:-.03em;margin:1.6rem 0 1rem;}}a{{color:var(--accent);}}.tasks-top{{display:flex;gap:1rem;justify-content:space-between;align-items:center;flex-wrap:wrap;font-size:.9rem;color:var(--muted);}}.tasks-top button{{font:inherit;min-height:44px;padding:.5rem .8rem;border:1px solid var(--line);border-radius:.3rem;background:var(--surface);color:var(--ink);cursor:pointer;}}:focus-visible{{outline:2px solid var(--focus);outline-offset:3px;}}@media(max-width:650px){{main{{width:auto;margin:1rem;}}}}
{css}</style></head><body><main><header><div class="tasks-top"><span>ОПИСиС · <a href="https://temasw.github.io/intro-to-networking/lectures/transmission-agreement.html" target="_blank" rel="noopener noreferrer">Тема 04</a></span><button id="tasks-theme">Сменить тему</button></div><h1>Расчётные задачи по теме 04</h1></header>{fragment}</main><script>document.getElementById('tasks-theme').onclick=()=>{{const e=document.documentElement;const dark=e.dataset.theme?e.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;e.dataset.theme=dark?'light':'dark';}};</script><script type="module">{model}\n{ui}</script></body></html>'''
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page, encoding='utf-8')
    if output.name == 'topic04-two-tasks.html':
        (output.parent / 'topic04-tasks.html').write_text(page, encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.tools/topic04-two-tasks.html')
    args = parser.parse_args()
    build(args.output)
    print(args.output)


if __name__ == '__main__':
    main()
