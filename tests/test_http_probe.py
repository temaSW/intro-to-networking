import importlib.util
from pathlib import Path
import socket

import pytest

spec = importlib.util.spec_from_file_location('http_probe', Path(__file__).parents[1] / 'scripts/http_probe.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


def test_public_address_and_fragment(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **k: [(socket.AF_INET, 1, 6, '', ('8.8.8.8', 443))])
    assert probe.public_url('https://host.test/path?q=1#part') == 'https://host.test/path?q=1'


@pytest.mark.parametrize('url', ['file:///etc/passwd', 'https://user:password@host.test/', 'http://host.test:8000/', 'https://host.test/\nheader'])
def test_reject_invalid_urls(url):
    with pytest.raises(ValueError):
        probe.public_url(url)


@pytest.mark.parametrize('ip', ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '192.168.1.1'])
def test_reject_private_addresses_and_redirects(monkeypatch, ip):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **k: [(socket.AF_INET, 1, 6, '', (ip, 80))])
    with pytest.raises(ValueError):
        probe.public_url('http://host.test/')
    with pytest.raises(ValueError):
        probe.PublicRedirects().redirect_request(None, None, 302, '', {}, 'http://host.test/')
