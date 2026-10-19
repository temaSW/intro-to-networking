"""Extract selected Pugovkin figures from a supplied local PDF (optional PyMuPDF)."""
import argparse
from pathlib import Path
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'course/assets/topic05'
FIGURES = {
    'pugovkin-pdh': (74, (56, 493, 542, 632)),
    'pugovkin-sdh-mapping': (77, (90, 395, 518, 604)),
    'pugovkin-sdh-sections': (78, (85, 394, 535, 556)),
    'pugovkin-stm1': (79, (80, 70, 515, 294)),
}


def extract(pdf):
    document = fitz.open(pdf)
    if document.page_count != 128:
        raise ValueError('Expected Pugovkin, TUSUR 2022, 128 pages.')
    OUT.mkdir(exist_ok=True)
    # Correct only the erroneous printed speed, preserving the source PDF on disk.
    page = document[73]
    page.draw_rect(fitz.Rect(370, 541.8, 415, 553), color=None, fill=(1, 1, 1), overlay=True)
    page.insert_font(fontname='CorrectedItalic', fontbuffer=document.extract_font(175)[3])
    page.insert_text((371, 550.8), '34368 кб/с', fontname='CorrectedItalic', fontsize=9.5)
    # Clarify two labels in the simplified STM-1 drawing against G.707.
    page = document[78]
    page.draw_rect(fitz.Rect(95, 90, 150, 153), color=None, fill=(1, 1, 1), overlay=True)
    page.insert_text((111, 125), 'RSOH', fontname='tibo', fontsize=10)
    page.draw_rect(fitz.Rect(230, 160, 345, 181), color=None, fill=(1, 1, 1), overlay=True)
    page.insert_font(fontname='CorrectedBold', fontbuffer=document.extract_font(14)[3])
    page.insert_text((231, 173), 'Начало VC-4', fontname='CorrectedBold', fontsize=10)
    page.draw_rect(fitz.Rect(260, 97, 348, 141), color=None, fill=(1, 1, 1), overlay=True)
    page.insert_text((271, 114), 'VC-4 n-1', fontname='CorrectedBold', fontsize=12)
    page.insert_text((278, 131), '(окончание)', fontname='CorrectedBold', fontsize=10)
    page.draw_rect(fitz.Rect(270, 200, 333, 232), color=None, fill=(1, 1, 1), overlay=True)
    page.insert_text((277, 214), 'VC-4 n', fontname='CorrectedBold', fontsize=12)
    page.insert_text((279, 229), '(начало)', fontname='CorrectedBold', fontsize=10)
    # The section diagram must show the same STM level along one optical path.
    page = document[77]
    page.draw_rect(fitz.Rect(164, 451.8, 194.5, 463.7), color=None, fill=(1, 1, 1), overlay=True)
    page.insert_text((164, 461.7), 'STM-N', fontname='tiro', fontsize=10)
    for name, (number, coordinates) in FIGURES.items():
        document[number - 1].get_pixmap(matrix=fitz.Matrix(3, 3), clip=fitz.Rect(coordinates)).save(OUT / f'{name}.png')
        print(name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    extract(parser.parse_args().pdf)
