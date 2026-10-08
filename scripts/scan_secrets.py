"""Fail closed; show finding locations, never scanner output or secret values."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from install_gitleaks import VERSION

ROOT = Path(__file__).resolve().parents[1]


def git(root, *args):
    return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL)


def snapshot(root, destination, staged):
    # Git's list includes tracked files even if now ignored, plus new nonignored files.
    args = ("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z") if staged else (
        "ls-files", "--cached", "--others", "--exclude-standard", "-z"
    )
    for raw in set(git(root, *args).split(b"\0")) - {b""}:
        relative = Path(os.fsdecode(raw))
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Unsafe Git path")
        source = root / relative
        target = destination / relative
        if staged:
            data = git(root, "show", ":" + relative.as_posix())
        else:
            if not source.exists():
                continue  # Locally deleted file is still covered by history.
            if source.is_symlink() or not source.is_file():
                raise ValueError("Source symlinks/submodules require explicit review")
            data = source.read_bytes()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def scan(binary, mode, target, scratch, root):
    report = scratch / "report.json"
    report.unlink(missing_ok=True)
    # Explicit upstream defaults prevent environment/local config or inline ignores
    # from silently weakening the mandatory scans. No baseline or allowlist.
    config = scratch / "defaults.toml"
    config.write_text("[extend]\nuseDefault = true\n", encoding="utf-8")
    ignore = scratch / "empty.ignore"
    ignore.write_text("", encoding="utf-8")
    args = [str(binary), mode, str(target), "--config", str(config),
            "--gitleaks-ignore-path", str(ignore), "--ignore-gitleaks-allow",
            "--redact=100", "--no-banner", "--no-color", "--max-archive-depth=5",
            "--max-decode-depth=5", "--report-format=json", "--report-path", str(report)]
    if mode == "git":
        args.append("--log-opts=--all --full-history -m")
    result = subprocess.run(args, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode not in (0, 1) or not report.is_file():
        print("Secret scan failed to execute; publication is blocked. Check installation and repository access.")
        return 2
    findings = json.loads(report.read_text(encoding="utf-8")) or []
    for finding in findings:
        # Only safe metadata is emitted; no Match, Secret, message or source excerpt.
        path = finding["File"]
        if mode == "dir":
            try:
                path = str(Path(path).relative_to(target))
            except ValueError:
                pass
        print(json.dumps({"file": path, "line": finding["StartLine"],
                          "rule": finding["RuleID"], "commit": finding.get("Commit", "")},
                         ensure_ascii=True))
    if findings or result.returncode:
        print(f"Secret scan blocked: {len(findings)} potential secret(s).")
        return 1
    print(f"Secret scan passed: {mode}.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["source", "staged", "site"])
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository root (also for isolated tests)")
    parser.add_argument("--site-dir", type=Path, help="Alternative complete artifact directory")
    options = parser.parse_args()
    root = options.root.resolve()
    binary = ROOT / ".tools" / "gitleaks" / ("gitleaks.exe" if os.name == "nt" else "gitleaks")
    if not binary.is_file():
        installed = shutil.which("gitleaks")
        if not installed:
            print("Install Gitleaks first: python scripts/install_gitleaks.py")
            return 2
        binary = Path(installed)
    try:
        version = subprocess.check_output([str(binary), "version"], stderr=subprocess.DEVNULL, text=True).strip()
        if version != VERSION:
            print(f"Gitleaks {VERSION} is required; run python scripts/install_gitleaks.py")
            return 2
        with tempfile.TemporaryDirectory(prefix="opisis-secret-scan-") as temporary:
            scratch = Path(temporary)
            if options.mode == "site":
                target = (options.site_dir or root / "course" / "_site").resolve()
                if not target.is_dir() or not any(target.iterdir()):
                    raise ValueError("Missing/empty Pages artifact")
                if any(path.is_symlink() for path in target.rglob("*")):
                    raise ValueError("Artifact contains symlinks")
                return scan(binary, "dir", target, scratch, root)
            if options.mode == "source":
                if git(root, "rev-parse", "--is-shallow-repository").strip() != b"false":
                    print("Full history is required: git fetch --unshallow --tags")
                    return 2
                result = scan(binary, "git", root, scratch, root)
                if result:
                    return result
            target = scratch / "files"
            target.mkdir()
            snapshot(root, target, options.mode == "staged")
            return scan(binary, "dir", target, scratch, root)
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        # Exception text may contain sensitive paths/content; do not echo it.
        print("Secret scan could not complete; publication is blocked. Check Git, files and Gitleaks.")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
