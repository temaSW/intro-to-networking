"""Generate SVG teaching figures for lecture 04 without third-party packages.

Run from repository root: python scripts/lecture-04/generate_assets.py
"""

from __future__ import annotations

import csv
import math
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "course" / "assets" / "lecture-04"
DATA = ROOT / "course" / "data" / "lecture-04" / "nr-mcs-table-4.csv"
W, H = 900, 500
INK, MUTED, GRID, ACCENT, ORANGE, BG = "#172b32", "#4d6268", "#b8c9ca", "#075b6a", "#b05515", "#f7f8f6"


def esc(value: object) -> str:
    return str(value).replace("&", "&amp;").replace("<", "&lt;")


def svg(body: str, title: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
  <title id="title">{esc(title)}</title><desc id="desc">Generated reproducibly by scripts/lecture-04/generate_assets.py.</desc>
  <rect width="100%" height="100%" fill="{BG}"/>
  <style>text{{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:{INK}}}.muted{{fill:{MUTED};font-size:15px}}.axis{{stroke:{INK};stroke-width:2}}.grid{{stroke:{GRID};stroke-width:1}}.label{{font-size:16px}}.title{{font-size:20px;font-weight:700}}</style>{body}</svg>'''


def write(name: str, body: str, title: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(svg(body, title), encoding="utf-8")


def shannon() -> None:
    left, right, top, bottom = 90, 850, 45, 430
    x = lambda db: left + (db + 10) / 45 * (right - left)
    y = lambda eta: bottom - eta / 12 * (bottom - top)
    body = '<text x="90" y="28" class="title">Предел Шеннона: ориентир, а не MCS-таблица</text>'
    for db in range(-10, 36, 5):
        body += f'<line x1="{x(db):.1f}" y1="{top}" x2="{x(db):.1f}" y2="{bottom}" class="grid"/><text x="{x(db):.1f}" y="455" text-anchor="middle" class="muted">{db}</text>'
    for eta in range(0, 13, 2):
        body += f'<line x1="{left}" y1="{y(eta):.1f}" x2="{right}" y2="{y(eta):.1f}" class="grid"/><text x="74" y="{y(eta)+5:.1f}" text-anchor="end" class="muted">{eta}</text>'
    points = " ".join(f"{x(db):.1f},{y(math.log2(1 + 10 ** (db / 10))):.1f}" for db in range(-10, 36))
    body += f'<line x1="{left}" y1="{bottom}" x2="{right}" y2="{bottom}" class="axis"/><line x1="{left}" y1="{top}" x2="{left}" y2="{bottom}" class="axis"/><polyline points="{points}" fill="none" stroke="{ACCENT}" stroke-width="4"/>'
    for db in (0, 10, 20, 30):
        eta = math.log2(1 + 10 ** (db / 10))
        body += f'<circle cx="{x(db):.1f}" cy="{y(eta):.1f}" r="5" fill="{ORANGE}"/><text x="{x(db)+9:.1f}" y="{y(eta)-10:.1f}" class="muted">{db} dB → {eta:.2f}</text>'
    body += '<text x="470" y="490" text-anchor="middle" class="label">SNR, dB</text><text x="22" y="240" transform="rotate(-90 22 240)" text-anchor="middle" class="label">η = C/B, bit/s/Hz</text>'
    write("shannon-se.svg", body, "Спектральная эффективность по формуле Шеннона")


def mcs() -> None:
    with DATA.open(encoding="utf-8") as file:
        rows = [row for row in csv.DictReader(line for line in file if not line.startswith("#"))]
    left, right, top, bottom = 80, 850, 45, 430
    x = lambda i: left + int(i) / 26 * (right - left)
    y = lambda eta: bottom - float(eta) / 10 * (bottom - top)
    colors = {"2": "#dcecef", "4": "#c8e1c8", "6": "#fae2bc", "8": "#e4d4ee", "10": "#ffd3cf"}
    names = {"2": "QPSK", "4": "16-QAM", "6": "64-QAM", "8": "256-QAM", "10": "1024-QAM"}
    groups = [("2", 0, 2), ("4", 3, 5), ("6", 6, 14), ("8", 15, 22), ("10", 23, 26)]
    body = '<text x="80" y="28" class="title">Реальная MCS-лестница 5G NR: Table 5.1.3.1-4</text>'
    for qm, start, end in groups:
        a, b = x(start) - 12, x(end) + 12
        body += f'<rect x="{a:.1f}" y="{top}" width="{b-a:.1f}" height="{bottom-top}" fill="{colors[qm]}"/><text x="{(a+b)/2:.1f}" y="{top+22}" text-anchor="middle" class="muted">{names[qm]}</text>'
    for eta in range(0, 11, 2):
        body += f'<line x1="{left}" y1="{y(eta):.1f}" x2="{right}" y2="{y(eta):.1f}" class="grid"/><text x="65" y="{y(eta)+5:.1f}" text-anchor="end" class="muted">{eta}</text>'
    points = " ".join(f"{x(r['mcs_index']):.1f},{y(r['spectral_efficiency']):.1f}" for r in rows)
    body += f'<polyline points="{points}" fill="none" stroke="{ACCENT}" stroke-width="3"/>'
    for r in rows:
        body += f'<circle cx="{x(r["mcs_index"]):.1f}" cy="{y(r["spectral_efficiency"]):.1f}" r="4" fill="{ACCENT}"/>'
    body += f'<line x1="{left}" y1="{bottom}" x2="{right}" y2="{bottom}" class="axis"/><line x1="{left}" y1="{top}" x2="{left}" y2="{bottom}" class="axis"/>'
    for index in range(0, 27, 2): body += f'<text x="{x(index):.1f}" y="455" text-anchor="middle" class="muted">{index}</text>'
    body += '<text x="470" y="490" text-anchor="middle" class="label">Iₘcₛ</text><text x="22" y="240" transform="rotate(-90 22 240)" text-anchor="middle" class="label">η ≈ QₘR, bit/s/Hz</text>'
    write("nr-mcs-se.svg", body, "Спектральная эффективность MCS таблицы 5G NR")


def constellation(name: str, side: int, noise: float = 0) -> None:
    left, right, top, bottom = 100, 800, 55, 430
    scale = min((right - left), (bottom - top)) / (side + 1)
    levels = [-(side - 1) + 2 * i for i in range(side)]
    body = f'<text x="90" y="28" class="title">{name}</text><line x1="{left}" y1="242" x2="{right}" y2="242" class="axis"/><line x1="450" y1="{top}" x2="450" y2="{bottom}" class="axis"/><text x="790" y="234" class="muted">I</text><text x="460" y="70" class="muted">Q</text>'
    random.seed(42)
    for i in levels:
        for q in levels:
            cx, cy = 450 + i * scale / 2, 242 - q * scale / 2
            body += f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5" fill="{ACCENT}"/>'
            if noise:
                for _ in range(7):
                    nx, ny = cx + random.gauss(0, noise * scale), cy + random.gauss(0, noise * scale)
                    body += f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="3" fill="{ORANGE}" fill-opacity=".52"/>'
    suffix = " Синие — идеальные; оранжевые — принятые точки." if noise else " Каждая точка — различимое состояние символа."
    body += f'<text x="90" y="475" class="muted">{suffix}</text>'
    filenames = {"QPSK": "qpsk.svg", "16-QAM": "16-qam.svg", "64-QAM": "64-qam.svg", "64-QAM + AWGN": "64-qam-awgn.svg"}
    write(filenames[name], body, name)


def main() -> None:
    shannon(); mcs()
    constellation("QPSK", 2)
    constellation("16-QAM", 4)
    constellation("64-QAM", 8)
    constellation("64-QAM + AWGN", 8, noise=.09)


if __name__ == "__main__":
    main()
