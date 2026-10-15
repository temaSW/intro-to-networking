"""Check the required tool versions and render the HTML course site."""

from pathlib import Path
import argparse
import os
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT / "course"
QUARTO_VERSION = "1.10.18"


def find_quarto() -> str | None:
    quarto = shutil.which("quarto")
    if quarto:
        return quarto
    if os.name == "nt" and (user_profile := os.environ.get("USERPROFILE")):
        installed = Path(user_profile) / "AppData" / "Local" / "Programs" / f"Quarto-{QUARTO_VERSION}" / "bin" / "quarto.exe"
        if installed.is_file():
            return str(installed)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    if sys.version_info < (3, 11):
        print("Python 3.11 or newer is required.", file=sys.stderr)
        return 2

    quarto = find_quarto()
    if quarto is None:
        print(f"Quarto {QUARTO_VERSION} is required: https://quarto.org/docs/get-started/", file=sys.stderr)
        return 2

    if not (COURSE / "_quarto.yml").is_file():
        print("Missing course/_quarto.yml.", file=sys.stderr)
        return 2

    version = subprocess.check_output([quarto, "--version"], text=True).strip()
    if version != QUARTO_VERSION:
        print(f"Quarto {QUARTO_VERSION} is required; found {version}.", file=sys.stderr)
        return 2
    print(f"Using Python {sys.version.split()[0]} and Quarto {version}", flush=True)
    environment = os.environ.copy()
    if os.name == "nt":
        # Keep Quarto's writable cache beside the project, including in restricted shells.
        local_cache = ROOT / ".tools" / "appdata"
        local_cache.mkdir(parents=True, exist_ok=True)
        environment["LOCALAPPDATA"] = str(local_cache)
    result = subprocess.run([quarto, "render", str(COURSE), "--to", "html"], cwd=ROOT, env=environment, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
