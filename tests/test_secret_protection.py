"""Exercise real Gitleaks in disposable repositories, never with real keys."""

import hashlib
import importlib.util
from pathlib import Path
import subprocess
import sys
import zipfile

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "scripts" / "scan_secrets.py"
# Assemble an invalid synthetic token at runtime so the fixture itself is safe.
TOKEN = "gh" + "p_" + hashlib.sha256(b"opisis-invalid-test-credential").hexdigest()[:36]


def git(root, *args):
    return subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


@pytest.fixture
def repository(tmp_path):
    git(tmp_path, "init")
    git(tmp_path, "config", "user.email", "test@example.invalid")
    git(tmp_path, "config", "user.name", "Secret scan test")
    (tmp_path / "clean.txt").write_text("Safe course content\n")
    git(tmp_path, "add", ".")
    git(tmp_path, "commit", "-m", "Clean initial commit")
    return tmp_path


def scan(root, mode, *extra):
    executable = ROOT / ".tools" / "gitleaks" / ("gitleaks.exe" if sys.platform == "win32" else "gitleaks")
    if not executable.is_file():
        pytest.skip("Run python scripts/install_gitleaks.py for scanner integration tests")
    result = subprocess.run([sys.executable, str(SCANNER), mode, "--root", str(root), *extra],
                            capture_output=True, text=True)
    assert TOKEN not in result.stdout + result.stderr
    return result


def test_clean_source_and_staged(repository):
    assert scan(repository, "source").returncode == 0
    assert scan(repository, "staged").returncode == 0


def test_new_working_file_is_scanned(repository):
    (repository / "new.js").write_text(f'const token = "{TOKEN}";\n')
    assert scan(repository, "source").returncode == 1


def test_staged_content_is_scanned_even_when_working_copy_is_clean(repository):
    file = repository / "new.js"
    file.write_text(f'const token = "{TOKEN}";\n')
    git(repository, "add", "new.js")
    file.write_text("// Clean unstaged replacement\n")
    assert scan(repository, "staged").returncode == 1


def test_unstaged_leak_does_not_replace_safe_index(repository):
    file = repository / "clean.txt"
    file.write_text(f'token = "{TOKEN}"\n')
    assert scan(repository, "staged").returncode == 0
    assert scan(repository, "source").returncode == 1


def test_removed_historical_secret_is_still_detected(repository):
    file = repository / "old.txt"
    file.write_text(TOKEN)
    git(repository, "add", ".")
    git(repository, "commit", "-m", "Synthetic leak")
    git(repository, "rm", "old.txt")
    git(repository, "commit", "-m", "Remove fixture")
    assert scan(repository, "source").returncode == 1


def test_secret_on_another_branch_is_detected(repository):
    branch = git(repository, "branch", "--show-current").stdout.decode().strip()
    git(repository, "checkout", "-b", "historical-leak")
    (repository / "old.txt").write_text(TOKEN)
    git(repository, "add", ".")
    git(repository, "commit", "-m", "Synthetic leak on other branch")
    git(repository, "checkout", branch)
    assert scan(repository, "source").returncode == 1


def test_secret_introduced_only_in_merge_is_detected(repository):
    branch = git(repository, "branch", "--show-current").stdout.decode().strip()
    git(repository, "checkout", "-b", "topic")
    (repository / "topic.txt").write_text("Safe topic content")
    git(repository, "add", ".")
    git(repository, "commit", "-m", "Topic")
    git(repository, "checkout", branch)
    (repository / "main.txt").write_text("Safe main content")
    git(repository, "add", ".")
    git(repository, "commit", "-m", "Main")
    git(repository, "merge", "topic", "--no-ff", "--no-commit")
    (repository / "merge.txt").write_text(TOKEN)
    git(repository, "add", ".")
    git(repository, "commit", "-m", "Merge containing synthetic leak")
    git(repository, "rm", "merge.txt")
    git(repository, "commit", "-m", "Remove fixture")
    assert scan(repository, "source").returncode == 1


@pytest.mark.parametrize("extension", ["html", "js", "json", "css", "txt", "env"])
def test_every_artifact_file_type_is_scanned(repository, extension):
    site = repository / "course" / "_site"
    site.mkdir(parents=True)
    (site / f"leak.{extension}").write_text(f'token = "{TOKEN}"\n')
    assert scan(repository, "site").returncode == 1


def test_archive_in_artifact_is_scanned(repository):
    site = repository / "course" / "_site"
    site.mkdir(parents=True)
    with zipfile.ZipFile(site / "resource.zip", "w") as archive:
        archive.writestr("resource.txt", TOKEN)
    assert scan(repository, "site").returncode == 1


def test_clean_artifact_and_missing_artifact(repository):
    assert scan(repository, "site").returncode == 2
    site = repository / "course" / "_site"
    site.mkdir(parents=True)
    (site / "index.html").write_text("<p>Safe content</p>")
    assert scan(repository, "site").returncode == 0


def test_inline_ignore_cannot_bypass_scanning(repository):
    (repository / "leak.txt").write_text(TOKEN + " # gitleaks:allow\n")
    assert scan(repository, "source").returncode == 1


def test_local_config_cannot_disable_scanning(repository):
    (repository / ".gitleaks.toml").write_text('[allowlist]\npaths = [".*"]\n')
    (repository / "leak.txt").write_text(TOKEN)
    assert scan(repository, "source").returncode == 1


def test_scanner_execution_error_fails_closed(repository, tmp_path, monkeypatch, capsys):
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location("scan_secrets_test", SCANNER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Even diagnostic output containing a synthetic token must remain private.
    monkeypatch.setattr(module.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(
        args=[], returncode=2, stdout=TOKEN.encode(), stderr=TOKEN.encode()))
    assert module.scan(Path("unused"), "dir", repository, tmp_path, repository) == 2
    assert TOKEN not in capsys.readouterr().out


def test_publication_has_no_failure_bypass():
    workflows = list((ROOT / ".github" / "workflows").glob("*.y*ml"))
    assert len(workflows) == 1
    workflow = workflows[0].read_text(encoding="utf-8")
    source = workflow.split("  source-scan:\n")[1].split("  render:\n")[0]
    render = workflow.split("  render:\n")[1].split("  deploy:\n")[0]
    deploy = workflow.split("  deploy:\n")[1]
    assert "fetch-depth: 0" in source
    assert "needs: source-scan" in render
    assert "needs: [source-scan, render]" in deploy
    assert render.index("python scripts/check.py") < render.index("python scripts/scan_secrets.py site")
    assert render.index("python scripts/scan_secrets.py site") < render.index("actions/upload-pages-artifact@")
    assert "continue-on-error" not in workflow
    assert "always()" not in workflow
    assert "pull_request_target" not in workflow
    assert "github.event_name != 'pull_request' && github.ref == 'refs/heads/main'" in deploy
    assert "pages: write" not in source + render
    assert "id-token: write" not in source + render
