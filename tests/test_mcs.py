"""Run the same JavaScript model used by the student-facing checks."""
from pathlib import Path
import subprocess


def test_mcs_model():
    root = Path(__file__).resolve().parents[1]
    subprocess.run(["node", "--test", "tests/test_mcs.mjs"], cwd=root, check=True)
