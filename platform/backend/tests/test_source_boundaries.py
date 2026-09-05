"""Independent adapter boundary tests; HTTP providers are explicitly local fixtures."""
from __future__ import annotations

import http.server
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest

import concord.runtime
from concord.runtime.sources import _JsonEndpoint, FilesystemSource, SourceError


class SourceBoundaries(unittest.TestCase):
    def provider(self):
        hits = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                hits.append(self.path)
                body = b'{"schema_version":1,"complete":true,"documents":[]}'
                if self.path == '/redirect':
                    self.send_response(302)
                    self.send_header('Location', '/sink')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body) + 100 if self.path == '/truncated' else len(body)))
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.write(body)
                self.close_connection = True

            def log_message(self, *_):
                pass

        service = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=service.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(service.server_close)
        self.addCleanup(service.shutdown)
        return f'http://127.0.0.1:{service.server_port}', hits

    def test_redirect_cannot_relay_credentials_to_new_location(self):
        base, hits = self.provider()
        endpoint = _JsonEndpoint(base + '/redirect', allow_loopback_http=True)
        with self.assertRaises(SourceError) as error:
            endpoint.get('Bearer SECRET-CANARY')
        self.assertEqual(hits, ['/redirect'])
        self.assertNotIn('SECRET-CANARY', str(error.exception))

    def test_premature_eof_never_yields_a_complete_payload(self):
        base, _ = self.provider()
        endpoint = _JsonEndpoint(base + '/truncated', allow_loopback_http=True)
        with self.assertRaises(SourceError):
            endpoint.get()

    def test_symlink_cannot_read_outside_configured_root(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        base = Path(temp.name)
        root = base / 'source'
        root.mkdir()
        (base / 'private.md').write_text('# Secret\nOUTSIDE-SECRET', encoding='utf-8')
        (root / 'escaped.md').symlink_to(base / 'private.md')
        snapshot = FilesystemSource(root, identities=['alex']).scan()
        self.assertFalse(snapshot.complete)
        self.assertNotIn('OUTSIDE-SECRET', repr(snapshot))


if __name__ == '__main__':
    unittest.main(verbosity=2)
