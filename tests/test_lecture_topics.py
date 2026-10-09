"""Exercise the build-time catalogue filter using Pandoc bundled with Quarto."""

from pathlib import Path
import shutil
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[1]
FILTER = ROOT / "course/_filters/lecture-topics.lua"


def pandoc_binary():
    if binary := shutil.which("pandoc"):
        return binary
    quarto = shutil.which("quarto")
    if quarto:
        directory = Path(quarto).resolve().parent
        for name in ("pandoc.exe", "pandoc"):
            candidate = directory / "tools" / name
            if candidate.exists():
                return str(candidate)
    pytest.skip("Pandoc or Quarto is required")


def render_catalogue(tmp_path, catalogue):
    lectures = tmp_path / "lectures"
    lectures.mkdir(exist_ok=True)
    (lectures / "index.qmd").write_text(catalogue, encoding="utf-8")
    for name in ("first", "second"):
        (lectures / f"{name}.qmd").write_text("# Lecture", encoding="utf-8")
    page = tmp_path / "index.qmd"
    page.write_text('::: {.home-topics source="lectures/index.qmd"}\n:::\n', encoding="utf-8")
    return subprocess.run(
        [pandoc_binary(), str(page), "--from=markdown", "--to=html", "--wrap=none", f"--lua-filter={FILTER}"],
        capture_output=True, text=True, encoding="utf-8", cwd=tmp_path,
    )


def test_catalogue_updates_preserve_order_links_and_markup(tmp_path):
    result = render_catalogue(tmp_path, "- [Тема 06. Second](second.qmd) — **Описание**.\n- [Тема 00. First](first.qmd) — Первый.\n")
    assert result.returncode == 0, result.stderr
    assert result.stdout.index("Тема 06") < result.stdout.index("Тема 00")
    assert 'href="lectures/second.qmd"' in result.stdout
    assert "<strong>Описание</strong>" in result.stdout
    result = render_catalogue(tmp_path, "- [Переименованная тема](first.qmd) — Новое описание.\n")
    assert result.returncode == 0, result.stderr
    assert "Переименованная тема" in result.stdout
    assert "Новое описание" in result.stdout
    assert "second.qmd" not in result.stdout


@pytest.mark.parametrize("catalogue", [
    "Нет опубликованных тем.\n",
    "- Тема без ссылки.\n",
    "- [Тема](missing.qmd) — Описание.\n",
    "- [Тема](https://example.com/topic.qmd) — Описание.\n",
])
def test_invalid_catalogue_stops_build(tmp_path, catalogue):
    result = render_catalogue(tmp_path, catalogue)
    assert result.returncode != 0
    assert "Lecture catalogue:" in result.stderr
