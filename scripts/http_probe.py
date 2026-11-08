"""Capture a bounded public HTTP GET for the application-layer demonstration."""
import argparse
from datetime import datetime, timezone
import ipaddress
import json
from pathlib import Path
import socket
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import build_opener, HTTPRedirectHandler, ProxyHandler, Request

MAX_BYTES = 256_000


def public_url(value):
    parts = urlsplit(value.strip())
    if parts.scheme not in ('http', 'https') or not parts.hostname:
        raise ValueError('A complete HTTP/HTTPS URL is required')
    if parts.username is not None or parts.password is not None:
        raise ValueError('Credentials in URLs are not supported')
    if parts.port not in (None, 80, 443):
        raise ValueError('Only standard HTTP/HTTPS ports are supported')
    if len(value) > 2048 or any(ord(char) < 32 for char in value):
        raise ValueError('Invalid URL')
    addresses = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError('Only public Internet addresses are supported')
    return urlunsplit(parts._replace(fragment=''))


class PublicRedirects(HTTPRedirectHandler):
    max_redirections = 5

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return super().redirect_request(request, fp, code, msg, headers, public_url(newurl))


def probe(url):
    started = time.monotonic()
    requested_at = datetime.now(timezone.utc).isoformat()
    url = public_url(url)
    opener = build_opener(ProxyHandler({}), PublicRedirects())
    request = Request(url, headers={'User-Agent': 'OPISiS-HTTP-Demo/1.0', 'Accept-Encoding': 'identity'})
    try:
        response = opener.open(request, timeout=15)
    except HTTPError as error:
        response = error  # A 404/403 is a received HTTP response, not a failed capture.
    with response:
        body = response.read(MAX_BYTES + 1)
        truncated = len(body) > MAX_BYTES
        body = body[:MAX_BYTES]
        content_type = response.headers.get('Content-Type', 'application/octet-stream')
        textual = content_type.startswith('text/') or any(value in content_type for value in ('json', 'xml', 'javascript'))
        encoding = response.headers.get_content_charset() or 'utf-8'
        try:
            text = body.decode(encoding, errors='replace') if textual else ''
        except LookupError:
            text = body.decode('utf-8', errors='replace') if textual else ''
        return {
            'schema': 'opisis-http-probe-v1', 'source': 'github-actions',
            'request': {'method': 'GET', 'url': url},
            'finalUrl': response.url, 'requestedAt': requested_at,
            'elapsedSeconds': round(time.monotonic() - started, 3),
            'status': response.code, 'type': content_type, 'byteLength': len(body),
            'truncated': truncated, 'textual': textual, 'text': text,
            'headers': {key: response.headers[key] for key in ('Content-Type', 'Content-Length', 'Content-Encoding', 'Location', 'Server') if key in response.headers},
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = probe(args.url)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'HTTP {result["status"]}; {result["byteLength"]} bytes; request {result["elapsedSeconds"]} s')


if __name__ == '__main__':
    main()
