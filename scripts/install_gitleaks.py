"""Install the pinned upstream binary after verifying its SHA-256."""

import hashlib
from pathlib import Path
import platform
import tarfile
import urllib.request
import zipfile
import io

VERSION = "8.30.1"
ASSETS = {
    "Windows": ("windows_x64.zip", "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e"),
    "Linux": ("linux_x64.tar.gz", "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"),
}
ROOT = Path(__file__).resolve().parents[1]


def main():
    system = platform.system()
    if system not in ASSETS or platform.machine().lower() not in {"amd64", "x86_64"}:
        raise SystemExit("Installer supports Windows/Linux x64; install the pinned release manually on other platforms.")
    asset, digest = ASSETS[system]
    url = f"https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_{asset}"
    with urllib.request.urlopen(url, timeout=120) as response:
        archive = response.read()
    if hashlib.sha256(archive).hexdigest() != digest:
        raise SystemExit("Gitleaks archive checksum mismatch.")
    name = "gitleaks.exe" if system == "Windows" else "gitleaks"
    if system == "Windows":
        with zipfile.ZipFile(io.BytesIO(archive)) as package:
            binary = package.read(name)
    else:
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
            with package.extractfile(name) as member:
                binary = member.read()
    destination = ROOT / ".tools" / "gitleaks" / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(binary)
    destination.chmod(0o755)
    print(f"Installed Gitleaks {VERSION} (SHA-256 verified).")


if __name__ == "__main__":
    main()
