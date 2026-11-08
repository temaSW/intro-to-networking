# Portable HTTP demonstration for Windows

`OPISiS-HTTP-Demo.exe` opens a local browser page and runs HTTP/HTTPS GET requests through Windows' system `curl.exe`. Windows 10/11 x64 with system curl is required. No administrator privileges, installer, Python installation, GitHub token, or hosted backend are needed at runtime.

The program binds only to `127.0.0.1` on an available port. The browser opens automatically. The page provides request, response and HTML text-preview buttons, plus **Завершить программу** to stop the process. Without a heartbeat from the page it stops after about three minutes. No startup entry or background service is installed. The executable is unsigned; Windows or an organisation's application policy may restrict its launch. Do not disable security checks or elevate privileges to run it.

## Build on Windows

The published v1.0.0 executable was built with Python 3.14.2 x64 and PyInstaller 6.22.0. From the repository root:

```powershell
python -m venv .tools/http-demo-build-env
.tools/http-demo-build-env/Scripts/python.exe -m pip install -r scripts/http_demo/requirements-build.txt
.tools/http-demo-build-env/Scripts/python.exe scripts/build_http_demo.py
```

Outputs are placed in `.tools/http-demo-dist`: one `.exe`, its SHA-256 checksum and component license notices. Generated build files remain outside Git. The executable includes its browser assets and Python runtime. `curl.exe` is used from Windows, not redistributed. Source content from the existing HTTP component is reused, rather than copied into a separately maintained UI.

## Boundaries and verification

Requests use a subprocess argument list, not a shell. Curl's config file is disabled; only HTTP/HTTPS protocols are permitted, including redirects. No browser cookies are forwarded. Responses are limited to 1 MiB, five redirects and 20 seconds. The program only retrieves content; it does not execute returned HTML or scripts. Local HTTP APIs check the exact Host, same-origin Origin, JSON content type and random per-launch URL path. No wildcard CORS access is granted. Content is not stored persistently.

`python -m pytest -q tests/test_http_demo.py` checks URL validation and local API access boundaries. Before publishing a new binary, run that actual `.exe` as a standard user, check live 200/404 responses, HTML preview, both themes, narrow screens and graceful shutdown. The PE manifest must request `asInvoker`, not elevation. The application may access local network HTTP resources entered by the user; it is a local teaching tool, not an anonymous public proxy.
