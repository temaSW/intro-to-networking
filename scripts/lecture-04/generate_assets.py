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
    body = '<text x="90" y="28" class="title">Предельная спектральная эффективность</text>'
    for db in range(-10, 36, 5):
        body += f'<line x1="{x(db):.1f}" y1="{top}" x2="{x(db):.1f}" y2="{bottom}" class="grid"/><text x="{x(db):.1f}" y="455" text-anchor="middle" class="muted">{db}</text>'
    for eta in range(0, 13, 2):
        body += f'<line x1="{left}" y1="{y(eta):.1f}" x2="{right}" y2="{y(eta):.1f}" class="grid"/><text x="74" y="{y(eta)+5:.1f}" text-anchor="end" class="muted">{eta}</text>'
    points = " ".join(f"{x(db):.1f},{y(math.log2(1 + 10 ** (db / 10))):.1f}" for db in range(-10, 36))
    body += f'<line x1="{left}" y1="{bottom}" x2="{right}" y2="{bottom}" class="axis"/><line x1="{left}" y1="{top}" x2="{left}" y2="{bottom}" class="axis"/><polyline points="{points}" fill="none" stroke="{ACCENT}" stroke-width="4"/>'
    for db in (0, 10, 20, 30):
        eta = math.log2(1 + 10 ** (db / 10))
        body += f'<circle cx="{x(db):.1f}" cy="{y(eta):.1f}" r="5" fill="{ORANGE}"/><text x="{x(db)+9:.1f}" y="{y(eta)-10:.1f}" class="muted">{db} dB → {eta:.2f}</text>'
    body += '<text x="470" y="490" text-anchor="middle" class="label">отношение сигнал/шум, дБ</text><text x="22" y="240" transform="rotate(-90 22 240)" text-anchor="middle" class="label">η = C/B, бит/с/Гц</text>'
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
    body = '<text x="80" y="28" class="title">Режимы MCS 5G NR: таблица 5.1.3.1-4</text>'
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
    body += '<text x="470" y="490" text-anchor="middle" class="label">индекс MCS</text><text x="22" y="240" transform="rotate(-90 22 240)" text-anchor="middle" class="label">η ≈ QₘR, бит/с/Гц</text>'
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
            if name == "QPSK":
                bits = f'{int(i > 0)}{int(q > 0)}'
                body += f'<text x="{cx + 12:.1f}" y="{cy - 10:.1f}" class="label">{bits}</text>'
            if noise:
                for _ in range(7):
                    nx, ny = cx + random.gauss(0, noise * scale), cy + random.gauss(0, noise * scale)
                    body += f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="3" fill="{ORANGE}" fill-opacity=".52"/>'
    suffix = " Синие — идеальные; оранжевые — принятые точки." if noise else " Каждая точка — различимое состояние символа."
    body += f'<text x="90" y="475" class="muted">{suffix}</text>'
    filenames = {"QPSK": "qpsk.svg", "16-QAM": "16-qam.svg", "64-QAM": "64-qam.svg", "64-QAM + AWGN": "64-qam-awgn.svg"}
    write(filenames[name], body, name)


def fft(values: list[complex]) -> list[complex]:
    """In-place radix-2 FFT, sufficient for reproducible Welch spectra."""
    size = len(values)
    j = 0
    for i in range(1, size):
        bit = size >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            values[i], values[j] = values[j], values[i]
    length = 2
    while length <= size:
        root = complex(math.cos(-2 * math.pi / length), math.sin(-2 * math.pi / length))
        for start in range(0, size, length):
            phase = 1 + 0j
            for offset in range(length // 2):
                even = values[start + offset]
                odd = phase * values[start + offset + length // 2]
                values[start + offset] = even + odd
                values[start + offset + length // 2] = even - odd
                phase *= root
        length *= 2
    return values


def keying_signal(mode: str, bits: list[int], samples_per_bit: int) -> list[float]:
    signal = []
    phase = 0.0
    for index in range(len(bits) * samples_per_bit):
        bit = bits[index // samples_per_bit]
        local = index % samples_per_bit
        if mode == "ask":
            value = bit * math.cos(2 * math.pi * 4 * local / samples_per_bit)
        elif mode == "fsk":
            phase += 2 * math.pi * (3 if bit == 0 else 5) / samples_per_bit
            value = math.cos(phase)
        else:
            value = math.cos(2 * math.pi * 4 * local / samples_per_bit + math.pi * bit)
        signal.append(value)
    return signal


def welch_db(signal: list[float], size: int) -> list[float]:
    """Hann-windowed, 50%-overlap periodogram average on a long bit stream."""
    window = [0.5 - 0.5 * math.cos(2 * math.pi * i / (size - 1)) for i in range(size)]
    power = [0.0] * (size // 2 + 1)
    windows = 0
    for start in range(0, len(signal) - size + 1, size // 2):
        spectrum = fft([complex(signal[start + i] * window[i]) for i in range(size)])
        for i in range(len(power)):
            power[i] += abs(spectrum[i]) ** 2
        windows += 1
    return [10 * math.log10(max(value / windows, 1e-20)) for value in power]


def keying_figures() -> None:
    """One figure: short oscillograms and Welch spectra from 4096 random bits."""
    shown_bits = [0, 1, 0, 1, 1, 0, 1, 0]
    # Highest tone is 5 cycles/bit; 64 samples/bit exceed 5 × Nyquist (50).
    samples_per_bit = 64
    rng = random.Random(42)
    long_bits = [rng.randrange(2) for _ in range(4096)]
    modes = [("ask", "ASK · амплитуда"), ("fsk", "FSK · частота"), ("psk", "PSK · фаза")]
    width, height = 1200, 860
    body = '<text x="35" y="42" class="title">Три способа различать биты</text><text x="300" y="88" text-anchor="middle" class="label">Сигнал во времени · 01011010</text><text x="900" y="88" text-anchor="middle" class="label">Усреднённая спектральная плотность, дБ</text>'
    for row, (mode, label) in enumerate(modes):
        top = 112 + row * 243
        baseline = top + 112
        x0, x1 = 120, 570
        sx0, sx1 = 680, 1160
        body += f'<text x="35" y="{top+24}" class="title">{label}</text>'
        for j, bit in enumerate(shown_bits):
            x = x0 + j * (x1-x0) / len(shown_bits)
            body += f'<rect x="{x:.1f}" y="{top+39}" width="{(x1-x0)/len(shown_bits):.1f}" height="153" fill="{"#e9f1f0" if j%2 == 0 else BG}"/><line x1="{x:.1f}" y1="{top+39}" x2="{x:.1f}" y2="{top+192}" class="grid"/><text x="{x+(x1-x0)/16:.1f}" y="{top+35}" text-anchor="middle" class="muted">{bit}</text>'
        signal = keying_signal(mode, shown_bits, samples_per_bit)
        points = " ".join(f"{x0+i/(len(signal)-1)*(x1-x0):.1f},{baseline-65*v:.1f}" for i, v in enumerate(signal))
        body += f'<line x1="{x0}" y1="{baseline}" x2="{x1}" y2="{baseline}" class="axis"/><polyline points="{points}" fill="none" stroke="{ACCENT}" stroke-width="2"/>'

        db = welch_db(keying_signal(mode, long_bits, samples_per_bit), 8192)
        peak = max(db)
        chart_top, chart_bottom = top + 39, top + 192
        for frequency in (0, 2, 4, 6, 8):
            x = sx0 + frequency/8 * (sx1-sx0)
            body += f'<line x1="{x:.1f}" y1="{chart_top}" x2="{x:.1f}" y2="{chart_bottom}" class="grid"/><text x="{x:.1f}" y="{chart_bottom+23}" text-anchor="middle" class="muted">{frequency}</text>'
        for level in (0, -20, -40, -60):
            y = chart_top - level/60 * (chart_bottom-chart_top)
            body += f'<line x1="{sx0}" y1="{y:.1f}" x2="{sx1}" y2="{y:.1f}" class="grid"/><text x="{sx0-9}" y="{y+5:.1f}" text-anchor="end" class="muted">{level}</text>'
        # 0..8 cycles per bit: 1025 of the 4097 one-sided FFT bins.
        spectrum = " ".join(f"{sx0+i/1024*(sx1-sx0):.1f},{chart_top+min(60,max(0,peak-db[i]))/60*(chart_bottom-chart_top):.1f}" for i in range(1025))
        body += f'<polyline points="{spectrum}" fill="none" stroke="{ORANGE}" stroke-width="2"/><line x1="{sx0}" y1="{chart_bottom}" x2="{sx1}" y2="{chart_bottom}" class="axis"/>'
    body += '<text x="920" y="846" text-anchor="middle" class="label">Частота, циклов на битовый интервал</text>'
    (OUT / "keying-comparison.svg").write_text(svg(body, "Амплитудная, частотная и фазовая манипуляция").replace('viewBox="0 0 900 500"', f'viewBox="0 0 {width} {height}"'), encoding="utf-8")


def qpsk_modulator() -> None:
    body = '''<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#075b6a"/></marker></defs>
<text x="35" y="36" class="title">Квадратурный модулятор QPSK</text>
<rect x="30" y="210" width="105" height="62" rx="8" fill="#dcecef" stroke="#075b6a"/><text x="82" y="246" text-anchor="middle" class="label">Биты</text>
<rect x="175" y="195" width="130" height="92" rx="8" fill="#dcecef" stroke="#075b6a"/><text x="240" y="229" text-anchor="middle" class="label">По парам</text><text x="240" y="257" text-anchor="middle" class="muted">b₀, b₁</text>
<rect x="350" y="75" width="105" height="60" rx="8" fill="#dcecef" stroke="#075b6a"/><text x="402" y="111" text-anchor="middle" class="label">I = ±1</text>
<rect x="350" y="350" width="105" height="60" rx="8" fill="#dcecef" stroke="#075b6a"/><text x="402" y="386" text-anchor="middle" class="label">Q = ±1</text>
<circle cx="590" cy="105" r="31" fill="#f7f8f6" stroke="#075b6a" stroke-width="2"/><text x="590" y="114" text-anchor="middle" class="title">×</text>
<circle cx="590" cy="380" r="31" fill="#f7f8f6" stroke="#075b6a" stroke-width="2"/><text x="590" y="389" text-anchor="middle" class="title">×</text>
<rect x="365" y="216" width="145" height="56" rx="8" fill="#fae2bc" stroke="#b05515"/><text x="437" y="250" text-anchor="middle" class="label">Генератор</text>
<rect x="505" y="282" width="88" height="48" rx="8" fill="#fae2bc" stroke="#b05515"/><text x="549" y="312" text-anchor="middle" class="label">90°</text>
<circle cx="745" cy="242" r="32" fill="#f7f8f6" stroke="#075b6a" stroke-width="2"/><text x="745" y="251" text-anchor="middle" class="title">+</text>
<path d="M135 241 H175 M305 218 H325 V105 H350 M305 264 H325 V380 H350 M455 105 H559 M455 380 H559 M621 105 H690 V225 H714 M621 380 H690 V259 H714 M777 242 H862" fill="none" stroke="#075b6a" stroke-width="2.5" marker-end="url(#arrow)"/>
<path d="M437 216 V158 H590 V136 M510 244 H549 V282 M549 330 V340 H590 V349" fill="none" stroke="#b05515" stroke-width="2.5" marker-end="url(#arrow)"/>
<text x="480" y="149" class="muted">cos(ωt)</text><text x="607" y="337" class="muted">−sin(ωt)</text><text x="787" y="222" class="label">s(t)</text>
<text x="450" y="467" text-anchor="middle" class="muted">Две ветви с несущими, сдвинутыми на 90°</text>'''
    write("qpsk-iq-modulator.svg", body, "Схема квадратурного модулятора QPSK")


def main() -> None:
    shannon(); mcs()
    constellation("QPSK", 2)
    constellation("16-QAM", 4)
    constellation("64-QAM", 8)
    constellation("64-QAM + AWGN", 8, noise=.09)
    keying_figures()
    qpsk_modulator()


if __name__ == "__main__":
    main()
