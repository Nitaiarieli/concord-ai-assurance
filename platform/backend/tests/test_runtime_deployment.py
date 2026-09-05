"""Real CLI/HTTP acceptance tests. Sources are edited outside Concord's API."""
from __future__ import annotations

import contextlib
import http.client
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

from concord.runtime.cli import ConfigurationError, DatabaseLease, initialize, load_config


def available_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class DeploymentAcceptanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / "deployment"
        self.process = None
        self.env = dict(os.environ)
        self.env["PYTHONPATH"] = os.pathsep.join(dict.fromkeys([os.getcwd(), *(p for p in sys.path if p)]))

    def tearDown(self) -> None:
        self.stop_process()
        self.temporary.cleanup()

    def request(self, method: str, path: str, token: str | None = None,
                payload=None, extra_headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        headers = {} if token is None else {"Authorization": "Bearer " + token}
        body = None
        if payload is not None:
            body = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        headers.update(extra_headers or {})
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            raw = response.read()
            return response.status, json.loads(raw)
        finally:
            connection.close()

    def wait_for(self, predicate, seconds=8):
        deadline = time.monotonic() + seconds
        last = None
        while time.monotonic() < deadline:
            if self.process is not None and self.process.poll() is not None:
                stdout, stderr = self.process.communicate()
                self.fail(f"Local runtime exited before acceptance check: {stdout} {stderr}")
            try:
                last = predicate()
                if last:
                    return last
            except (OSError, http.client.HTTPException):
                pass
            time.sleep(0.05)
        self.fail(f"Automatic synchronization acceptance check did not complete; last={last!r}")

    def start_process(self):
        self.process = subprocess.Popen(
            [sys.executable, "-m", "concord.runtime", "run", "--config", str(self.config_path)],
            env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        self.wait_for(lambda: self.request("GET", "/healthz") == (200, {"status": "ok"}))

    def stop_process(self):
        if self.process is not None:
            if self.process.poll() is None:
                self.process.send_signal(signal.SIGTERM)
            try:
                self.process.communicate(timeout=4)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.communicate()
                self.fail("Runtime did not shut down within four seconds")
            self.process = None

    def setup_cli(self):
        result = subprocess.run([sys.executable, "-m", "concord.runtime", "init", "--directory", str(self.root)],
                                env=self.env, capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.config_path = self.root / "runtime.json"
        self.secret_path = self.root / "credentials.local.json"
        self.credentials = json.loads(self.secret_path.read_text())
        self.operator = self.credentials["operator_token"]
        self.alex = self.credentials["consumers"]["alex_support"]["token"]
        self.jordan = self.credentials["consumers"]["jordan_success"]["token"]
        for token in (self.operator, self.alex, self.jordan):
            self.assertGreaterEqual(len(token), 43)
            self.assertNotIn(token, result.stdout + result.stderr)
        if os.name == "posix":
            self.assertEqual(self.secret_path.stat().st_mode & 0o777, 0o600)
        self.port = available_port()
        config = json.loads(self.config_path.read_text())
        config.update(port=self.port, poll_interval_seconds=1)
        self.config_path.write_text(json.dumps(config))
        return result

    def retrieve_content(self, token, query):
        code, body = self.request("POST", "/v1/retrieve", token, {"query": query})
        if code != 200 or body["status"] != "current":
            return None
        return " ".join(document["content"] for document in body["documents"])

    def test_cli_automatic_content_acl_outage_delete_and_restart(self):
        """No manual Concord sync call: a file edit reaches both actual HTTP routes."""
        self.setup_cli()
        self.start_process()
        for token in (self.alex, self.jordan):
            self.wait_for(lambda token=token: "30 days" in (self.retrieve_content(token, "Atlas") or ""))
        # Repeat the success route before mutation to exercise its real response cache.
        self.assertIn("30 days", self.retrieve_content(self.jordan, "Atlas"))
        document_path = self.root / "source" / "product-policy.json"
        document = json.loads(document_path.read_text())
        document["content"] = "The Atlas plan now includes 45 days of support. New release sentinel: evergreen928."
        changed_at = time.monotonic()
        document_path.write_text(json.dumps(document))
        for token, identity, route in ((self.alex, "alex", "support"), (self.jordan, "jordan", "success")):
            self.wait_for(lambda token=token: "evergreen928" in (self.retrieve_content(token, "evergreen928") or ""))
            code, body = self.request("POST", "/v1/retrieve", token, {"query": "evergreen928"})
            self.assertEqual((code, body["identity"], body["route"]), (200, identity, route))
            self.assertNotIn("30 days", json.dumps(body))
        self.assertLess(time.monotonic() - changed_at, 8, "Fixture-specific measured deadline, not an enterprise SLA")
        # Persisted state survives a clean stop/restart; observation still resumes automatically.
        self.stop_process()
        self.start_process()
        self.wait_for(lambda: "evergreen928" in (self.retrieve_content(self.jordan, "evergreen928") or ""))
        # Change the source ACL externally. Alex loses this document, Jordan retains access.
        document["acl"] = ["jordan"]
        document_path.write_text(json.dumps(document))
        self.wait_for(lambda: self.retrieve_content(self.alex, "evergreen928") == ""
                      and "evergreen928" in (self.retrieve_content(self.jordan, "evergreen928") or ""))
        self.assertIn("Tuesday", self.retrieve_content(self.alex, "Tuesday"))
        # An unavailable root is not an empty authoritative snapshot or a deletion.
        source_path = self.root / "source"
        held_path = self.root / "source-unavailable"
        source_path.rename(held_path)
        def blocked():
            code, body = self.request("POST", "/v1/retrieve", self.jordan, {"query": "evergreen928"})
            return code == 200 and body["status"] == "blocked" and body["documents"] == []
        self.wait_for(blocked)
        held_path.rename(source_path)
        self.wait_for(lambda: "evergreen928" in (self.retrieve_content(self.jordan, "evergreen928") or ""))
        # A successful complete scan now observes a real deletion.
        document_path.unlink()
        self.wait_for(lambda: self.retrieve_content(self.jordan, "evergreen928") == "")
        self.assertIn("Tuesday", self.retrieve_content(self.alex, "Tuesday"))
        code, status = self.request("GET", "/v1/status", self.operator)
        self.assertEqual(code, 200)
        self.assertEqual(status["runtime"]["deployment"], "single_tenant_loopback")

    def test_authentication_and_browser_boundaries(self):
        self.setup_cli()
        self.start_process()
        self.assertEqual(self.request("GET", "/v1/status")[0], 401)
        self.assertEqual(self.request("GET", "/v1/status", self.alex)[0], 403)
        self.assertEqual(self.request("POST", "/v1/retrieve", self.operator, {"query": "Atlas"})[0], 403)
        for payload in ({"query": "Atlas", "identity": "jordan"}, {"query": "Atlas", "route": "success"}):
            self.assertEqual(self.request("POST", "/v1/retrieve", self.alex, payload)[0], 400)
        self.assertEqual(self.request("POST", "/v1/retrieve", self.alex, {"query": "Atlas"},
                                     {"Origin": "https://outside.example"})[0], 403)
        self.assertEqual(self.request("GET", "/healthz", extra_headers={"Host": "outside.example"})[0], 403)
        self.assertEqual(self.request("GET", "/healthz?token=not-a-secret")[0], 400)
        self.assertEqual(self.request("POST", "/v1/source", self.operator, {"content": "change"})[0], 404)

    def test_init_refuses_overwrite_and_state_binding_refuses_scope_change(self):
        self.setup_cli()
        original_secret = self.secret_path.read_bytes()
        result = subprocess.run([sys.executable, "-m", "concord.runtime", "init", "--directory", str(self.root)],
                                env=self.env, capture_output=True, text=True, timeout=5)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.secret_path.read_bytes(), original_secret)
        config, _ = load_config(self.config_path)
        with DatabaseLease(config):
            pass
        changed = dict(config, tenant_id="different-tenant")
        with self.assertRaises(ConfigurationError):
            with DatabaseLease(changed):
                pass
        changed = dict(config, source=dict(config["source"], identities=["alex", "jordan"]))
        with self.assertRaises(ConfigurationError):
            with DatabaseLease(changed):
                pass
        with DatabaseLease(config):
            with self.assertRaises(ConfigurationError):
                with DatabaseLease(config):
                    pass

    def test_configuration_rejects_inline_secrets_unsafe_scope_and_unknown_options(self):
        self.setup_cli()
        config = json.loads(self.config_path.read_text())
        for source in ({"type": "json_http", "url": "https://example.invalid/feed?token=not-a-secret"},
                       {"type": "json_http", "url": "https://example.invalid/feed", "token": "not-a-secret"},
                       {"type": "filesystem", "directory": "."},
                       {"type": "filesystem", "directory": "source", "max_files": 999999}):
            config["source"] = source
            self.config_path.write_text(json.dumps(config))
            with self.assertRaises(ConfigurationError):
                load_config(self.config_path)


if __name__ == "__main__":
    unittest.main()
