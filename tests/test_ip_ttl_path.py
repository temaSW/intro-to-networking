"""Finite IP delivery and Windows tracert teaching animations."""
from pathlib import Path
import subprocess


def test_ip_ttl_path_model_and_controls():
    result = subprocess.run(
        ['node', str(Path(__file__).with_name('check_ip_ttl_path_ui.cjs'))],
        capture_output=True, text=True, encoding='utf-8',
    )
    assert result.returncode == 0, result.stdout + result.stderr
