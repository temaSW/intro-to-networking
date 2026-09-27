"""Canonical project check: validate prerequisites and render the entire site."""

from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT / "course"


def main() -> int:
    if sys.version_info < (3, 11):
        print("Python 3.11 or newer is required.", file=sys.stderr)
        return 2

    quarto = shutil.which("quarto")
    if quarto is None:
        print("Quarto CLI is required: https://quarto.org/docs/get-started/", file=sys.stderr)
        return 2

    if not (COURSE / "_quarto.yml").is_file():
        print("Missing course/_quarto.yml.", file=sys.stderr)
        return 2

    print(f"Using {sys.version.split()[0]} and {subprocess.check_output([quarto, '--version'], text=True).strip()}", flush=True)
    result = subprocess.run([quarto, "render", str(COURSE)], cwd=ROOT, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
