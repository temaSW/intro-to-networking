"""Generate the responsive FDM/OFDM teaching diagram using only Python stdlib.

Run: python scripts/lecture-04/generate_fdm_ofdm.py
Only main lobes of sinc-squared spectra are drawn. FDM spacing is illustrative;
the marked saving compares their main-lobe spans, not a spectral-mask bandwidth.
OFDM spacing is 1/T; adjacent centres lie at the spectral zeros.
"""
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "course/_includes/lecture-04-fdm-ofdm.qmd"


def spectrum(width: int, mobile: bool) -> str:
    height = 640
    left, right = (48, width - 24) if mobile else (70, width - 30)
    scale = (right - left) / 11.5
    x = lambda f: left + f * scale
    mode = "narrow" if mobile else "wide"
    ident = f"fdm-ofdm-{mode}"
    parts = [f'''<svg class="fdm-ofdm-svg fdm-ofdm-{mode}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="{ident}-title {ident}-desc">
<title id="{ident}-title">FDM и OFDM: размещение пяти каналов в полосе</title>
<desc id="{ident}-desc">Сверху пять разнесённых основных лепестков FDM. Снизу пять перекрывающихся лепестков OFDM; пик каждой поднесущей совпадает с нулями остальных. Частотный масштаб одинаковый. Справа выделена экономия полосы в этом схематическом сравнении.</desc>
<defs><marker id="{ident}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" class="spectrum-arrow"/></marker></defs>''']
    for row, (name, spacing) in enumerate((("FDM", 2.25), ("OFDM", 1.0))):
        baseline = 240 + 320 * row
        peak = baseline - 118
        title_y = baseline - 198
        subtitle = "Разнесённые частотные каналы" if row == 0 else "Ортогональные поднесущие"
        parts.append(f'<text x="{left}" y="{title_y}" class="spectrum-title">{name}</text>')
        parts.append(f'<text x="{left}" y="{title_y+32}" class="spectrum-subtitle">{subtitle}</text>')
        if row == 1:
            a, b = x(6), x(11)
            parts.append(f'<rect x="{a:.2f}" y="{peak-10}" width="{b-a:.2f}" height="{baseline-peak+10}" class="spectrum-saving"/>')
            parts.append(f'<path d="M{a:.2f} {peak-14} V{baseline+8} M{b:.2f} {peak-14} V{baseline+8}" class="spectrum-guide"/>')
            parts.append(f'<path d="M{a+5:.2f} {baseline-62} H{b-5:.2f}" class="spectrum-dimension" marker-start="url(#{ident}-arrow)" marker-end="url(#{ident}-arrow)"/>')
            parts.append(f'<text x="{(a+b)/2:.2f}" y="{baseline-105}" text-anchor="middle" class="spectrum-subtitle">Экономия</text><text x="{(a+b)/2:.2f}" y="{baseline-79}" text-anchor="middle" class="spectrum-subtitle">полосы</text>')
        parts.append(f'<path d="M{left} {baseline+8} V{peak-22} M{left} {baseline} H{right+8}" class="spectrum-axis" marker-end="url(#{ident}-arrow)"/>')
        parts.append(f'<text x="{left-20}" y="{(peak+baseline)/2}" transform="rotate(-90 {left-20} {(peak+baseline)/2})" text-anchor="middle" class="spectrum-subtitle">Мощность</text>')
        parts.append(f'<text x="{right}" y="{baseline+38}" text-anchor="end" class="spectrum-subtitle">Частота</text>')
        for k in range(5):
            centre = 1 + k * spacing
            if row == 1:
                parts.append(f'<path d="M{x(centre):.2f} {peak-5} V{baseline}" class="spectrum-guide"/>')
            pts = []
            for j in range(161):
                delta = -1 + j / 80
                power = 1.0 if abs(delta) < 1e-12 else (math.sin(math.pi*delta)/(math.pi*delta))**2
                pts.append(f"{x(centre+delta):.2f},{baseline-118*power:.2f}")
            points = " ".join(pts)
            parts.append(f'<polyline points="{points}" class="spectrum-channel spectrum-channel-{k+1}"/>')
            parts.append(f'<text x="{x(centre):.2f}" y="{peak-12}" text-anchor="middle" class="spectrum-number">{k+1}</text>')
    parts.append('</svg>')
    return "\n".join(parts)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('<div class="fdm-ofdm-figure">\n' + spectrum(920, False) + '\n' + spectrum(460, True) + '\n</div>\n', encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
