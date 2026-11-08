"""Portable, loopback-only HTTP classroom demonstration. No installation required."""
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlsplit, urlunsplit
import webbrowser

LIMIT = 1_048_576
ASSETS = Path(__file__).resolve().parent / 'web'
ACTIVE = set()
ACTIVE_LOCK = threading.Lock()


def kill_active():
    with ACTIVE_LOCK:
        for process in list(ACTIVE):
            if process.poll() is None:
                process.kill()


def validate_url(value):
    if not isinstance(value, str) or len(value) > 4096 or any(ord(c) < 32 for c in value):
        raise ValueError('Некорректный адрес.')
    parts = urlsplit(value.strip())
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username is not None or parts.password is not None:
        raise ValueError('Нужен адрес HTTP/HTTPS без имени пользователя и пароля.')
    parts.port  # Validate malformed ports before invoking curl.
    return urlunsplit(parts._replace(fragment=''))


def system_curl():
    binary = Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32' / 'curl.exe'
    if not binary.is_file():
        raise RuntimeError('Не найден системный curl.exe. Нужна Windows 10/11 с установленным curl.')
    return str(binary)


def request_url(url):
    url = validate_url(url)
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='opisis-http-') as temp:
        body = Path(temp) / 'body'
        command = [system_curl(), '--disable', '--silent', '--show-error', '--location',
                   '--max-redirs', '5', '--proto', '=http,https', '--proto-redir', '=http,https',
                   '--connect-timeout', '8', '--max-time', '20', '--max-filesize', str(LIMIT),
                   '--compressed', '--output', str(body), '--write-out', '%{json}', '--url', url]
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        with ACTIVE_LOCK:
            ACTIVE.add(process)
        try:
            output, _ = process.communicate(timeout=23)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
            raise
        finally:
            with ACTIVE_LOCK:
                ACTIVE.discard(process)
        if process.returncode:
            if process.returncode == 63:
                raise ValueError('Ответ больше 1 МиБ. Для показа выберите страницу меньшего размера.')
            raise ValueError(f'curl не получил полный ответ (код {process.returncode}). Проверьте адрес, доступность сайта и подключение.')
        metadata = json.loads(output)
        if body.stat().st_size > LIMIT:
            raise ValueError('Ответ больше 1 МиБ.')
        data = body.read_bytes()
        content_type = metadata.get('content_type') or 'application/octet-stream'
        textual = content_type.startswith('text/') or any(x in content_type for x in ('json', 'xml', 'javascript'))
        import re
        charset = re.search(r'charset\s*=\s*[\"\']?([^\s;\"\']+)', content_type, re.I)
        try:
            text = data.decode(charset[1] if charset else 'utf-8', errors='replace') if textual else ''
        except LookupError:
            text = data.decode('utf-8', errors='replace') if textual else ''
        return {'status': metadata['http_code'], 'type': content_type, 'byteLength': len(data),
                'text': text, 'textual': textual, 'truncated': False, 'source': 'local-curl',
                'finalUrl': metadata.get('url_effective', url),
                'requestedAt': datetime.now(timezone.utc).isoformat(),
                'elapsedSeconds': round(time.monotonic() - started, 3)}


class DemoServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        self.key = secrets.token_urlsafe(24)
        self.last_seen = time.monotonic()
        self.gate = threading.Lock()
        super().__init__(('127.0.0.1', 0), Handler)
        self.origin = f'http://127.0.0.1:{self.server_port}'
        self.url = f'{self.origin}/{self.key}/'


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send_data(self, status, data, kind='application/json; charset=utf-8'):
        if not isinstance(data, bytes):
            data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def valid_host(self):
        return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'

    def do_GET(self):
        if not self.valid_host():
            return self.send_data(403, {'error': 'Недопустимый адрес сервера.'})
        names = {'': 'index.html', 'local.js': 'local.js', 'base.css': 'base.css',
                 'application-layer.css': 'application-layer.css',
                 'http-exchange-model.js': 'http-exchange-model.js', 'http-exchange-ui.js': 'http-exchange-ui.js', 'licenses.txt': 'licenses.txt'}
        prefix = f'/{self.server.key}/'
        relative = self.path[len(prefix):] if self.path.startswith(prefix) else None
        if relative not in names:
            return self.send_data(404, {'error': 'Страница не найдена.'})
        file = ASSETS / names[relative]
        kind = 'text/javascript' if file.suffix == '.js' else 'text/css' if file.suffix == '.css' else 'text/plain' if file.suffix == '.txt' else 'text/html'
        self.send_data(200, file.read_bytes(), kind + '; charset=utf-8')

    def do_POST(self):
        if not self.valid_host() or self.headers.get('Origin') != self.server.origin:
            return self.send_data(403, {'error': 'Запрос разрешён только из окна демонстрации.'})
        if self.headers.get('Content-Type') != 'application/json':
            return self.send_data(415, {'error': 'Ожидался JSON.'})
        prefix = f'/{self.server.key}/'
        action = self.path[len(prefix):] if self.path.startswith(prefix) else ''
        if action not in ('request', 'heartbeat', 'stop'):
            return self.send_data(404, {'error': 'Неизвестное действие.'})
        self.server.last_seen = time.monotonic()
        if action == 'heartbeat':
            return self.send_data(200, {'ok': True})
        if action == 'stop':
            self.send_data(200, {'ok': True})
            kill_active()
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        if not self.server.gate.acquire(blocking=False):
            return self.send_data(409, {'error': 'Предыдущий запрос ещё выполняется.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8192:
                raise ValueError('Слишком большой или пустой запрос.')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Ожидался объект с адресом.')
            self.send_data(200, request_url(data.get('url')))
        except (ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
            message = str(error) if not isinstance(error, subprocess.TimeoutExpired) else 'Время ожидания истекло.'
            self.send_data(400, {'error': message})
        finally:
            self.server.gate.release()


def main():
    try:
        system_curl()
        server = DemoServer()
        def watchdog():
            while time.monotonic() - server.last_seen < 180:
                time.sleep(5)
            server.shutdown()
        threading.Thread(target=watchdog, daemon=True).start()
        if '--no-browser' not in sys.argv:
            webbrowser.open(server.url)
        if '--session-file' in sys.argv:
            Path(sys.argv[sys.argv.index('--session-file') + 1]).write_text(server.url, encoding='utf-8')
        server.serve_forever(poll_interval=.2)
        kill_active()
        server.server_close()
    except Exception as error:
        if os.name == 'nt' and '--no-browser' not in sys.argv:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, str(error), 'ОПИСиС: HTTP-демонстрация', 0x10)
        else:
            raise


if __name__ == '__main__':
    main()
