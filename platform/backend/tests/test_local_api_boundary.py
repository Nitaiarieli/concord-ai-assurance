"""Independent HTTP boundary checks; fake core isolates server authorization behavior."""
from __future__ import annotations

import http.client
import importlib.util
import json
import sys
import threading
import time
import unittest
from pathlib import Path

from concord.runtime import server

OPERATOR = 'operator_' + 'O' * 48
CONSUMER = 'consumer_' + 'C' * 48


class Core:
    def __init__(self, blocked=False):
        self.blocked = blocked
        self.entered = threading.Event()
        self.release = threading.Event()
        self.calls = []

    def tick(self):
        self.entered.set()
        if self.blocked:
            self.release.wait(10)

    def status(self):
        return {'state': 'current'}

    def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        return {'items': [], 'identity': kwargs['identity'], 'route': kwargs['route']}

    def close(self):
        pass


class LocalApiBoundary(unittest.TestCase):
    def start(self, blocked=False):
        core = Core(blocked)
        policy = server.AccessPolicy(OPERATOR, (server.ConsumerCredential(CONSUMER, 'alex', 'support'),))
        service = server.RuntimeService(core, policy, port=0, poll_interval=60, console_html=b'<html>local</html>')
        service.start()
        self.assertTrue(core.entered.wait(2))
        self.addCleanup(service.stop)
        self.addCleanup(core.release.set)
        return service, core

    def request(self, service, method, path, token=None, payload=None, **headers):
        conn = http.client.HTTPConnection('127.0.0.1', service.port, timeout=3)
        if token:
            headers['Authorization'] = 'Bearer ' + token
        body = None
        if payload is not None:
            body = json.dumps(payload)
            headers['Content-Type'] = 'application/json'
        try:
            conn.request(method, path, body, headers)
            response = conn.getresponse()
            status, body, output_headers = response.status, response.read(), dict(response.getheaders())
            self.assertNotIn(OPERATOR.encode(), body)
            self.assertNotIn(CONSUMER.encode(), body)
            return status, json.loads(body), output_headers
        finally:
            conn.close()

    def test_role_separation_and_bound_identity(self):
        service, core = self.start()
        self.assertEqual(self.request(service, 'GET', '/v1/status', CONSUMER)[0], 403)
        self.assertEqual(self.request(service, 'POST', '/v1/retrieve', OPERATOR, {'query': 'product'})[0], 403)
        self.assertEqual(self.request(service, 'POST', '/v1/retrieve', CONSUMER,
                                      {'query': 'product', 'identity': 'jordan', 'route': 'success'})[0], 400)
        code, result, _ = self.request(service, 'POST', '/v1/retrieve', CONSUMER, {'query': 'product'})
        self.assertEqual(code, 200)
        self.assertEqual(core.calls, [{'query': 'product', 'identity': 'alex', 'route': 'support'}])

    def test_cross_origin_host_and_query_credentials_are_rejected(self):
        service, _ = self.start()
        self.assertEqual(self.request(service, 'GET', '/v1/status', OPERATOR,
                                      Origin='https://untrusted.example')[0], 403)
        self.assertEqual(self.request(service, 'GET', '/v1/status', OPERATOR,
                                      Host='untrusted.example')[0], 403)
        self.assertEqual(self.request(service, 'GET', '/v1/status?token=secret-marker', OPERATOR)[0], 400)
        self.assertEqual(self.request(service, 'GET', '/v1/status')[0], 401)

    def test_operator_cannot_mutate_source_via_http(self):
        service, _ = self.start()
        code, _, headers = self.request(service, 'POST', '/v1/source', OPERATOR, {'content': 'attacker'})
        self.assertEqual(code, 404)
        self.assertNotIn('Access-Control-Allow-Origin', headers)
        self.assertEqual(headers['Cache-Control'], 'no-store')

    def test_status_does_not_hang_behind_blocked_source_poll(self):
        service, _ = self.start(blocked=True)
        started = time.monotonic()
        code, result, _ = self.request(service, 'GET', '/v1/status', OPERATOR)
        elapsed = time.monotonic() - started
        self.assertEqual(code, 503)
        self.assertLess(elapsed, 2)
        self.assertTrue(result.get('error'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
