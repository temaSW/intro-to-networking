"""Run checks for IPv4 exercise validation, including alternative valid plans."""
from pathlib import Path
import subprocess


def test_ip_addressing_validation():
    result = subprocess.run(
        ["node", "--test", str(Path(__file__).with_suffix(".mjs"))],
        capture_output=True, text=True, encoding="utf-8",
    )
    assert result.returncode == 0, result.stdout + result.stderr
