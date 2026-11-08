"""Loopback API boundary checks; runtime curl integration is checked on Windows."""
from http.client import HTTPConnection
import importlib.util
import json
from pathlib import Path
import threading

import pytest

spec = importlib.util.spec_from_file_location('portable_http_demo', Path(__file__).parents[1] / 'scripts/http_demo/app.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


@pytest.fixture
def server(monkeypatch):
    monkeypatch.setattr(app, 'request_url', lambda url: {'status': 200, 'text': url})
    server = app.DemoServer()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
    server.server_close()
    thread.join()


def call(server, path, origin=None, host=None, body='{}'):
    connection = HTTPConnection('127.0.0.1', server.server_port, timeout=3)
    headers = {'Content-Type': 'application/json'}
    if origin is not None:
        headers['Origin'] = origin
    if host is not None:
        headers['Host'] = host
    connection.request('POST', path, body, headers)
    response = connection.getresponse()
    result = response.status, dict(response.getheaders()), json.loads(response.read())
    connection.close()
    return result


def test_only_local_origin_can_request(server):
    path = f'/{server.key}/request'
    assert call(server, path)[0] == 403
    assert call(server, path, 'https://unrelated.test')[0] == 403
    assert call(server, path, 'null')[0] == 403
    status, headers, body = call(server, path, server.origin, body='{"url":"https://test.invalid/"}')
    assert status == 200 and body['status'] == 200
    assert 'Access-Control-Allow-Origin' not in headers


def test_host_and_session_are_checked(server):
    assert call(server, f'/{server.key}/request', server.origin, host='unrelated.test')[0] == 403
    assert call(server, '/wrong-session/request', server.origin)[0] == 404
    assert call(server, f'/{server.key}/request', server.origin, body='[]')[0] == 400


@pytest.mark.parametrize('url', ['file:///C:/Windows/win.ini', 'https://user:password@site.test/', '-o file', 'https://site.test/\nheader'])
def test_command_cannot_accept_file_scheme_credentials_or_options(url):
    with pytest.raises(ValueError):
        app.validate_url(url)


def test_normal_url_fragment_is_removed():
    assert app.validate_url('https://site.test/page?q=1#part') == 'https://site.test/page?q=1'
