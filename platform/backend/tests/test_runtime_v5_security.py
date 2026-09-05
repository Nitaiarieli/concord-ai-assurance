"""Independent regressions for API trust and whole-response timeout boundaries."""
import socket
import tempfile
import threading
import time
import unittest
from pathlib import Path

from concord.runtime.core import SyncRuntime
from concord.runtime.sources import JsonHttpSnapshotSource, SourceError, _JsonEndpoint


class IndependentApiSecurityTests(unittest.TestCase):
    def test_generic_api_does_not_infer_deletion_authority_by_default(self):
        source = JsonHttpSnapshotSource("http://127.0.0.1:1/snapshot", allow_loopback_http=True)
        source.endpoint.get = lambda *_: {"schema_version": 1, "complete": True, "documents": []}
        snapshot = source.scan()
        self.assertTrue(snapshot.complete)
        self.assertFalse(snapshot.deletion_authoritative)

    def test_non_authoritative_api_omission_retains_and_blocks_existing_document(self):
        source = JsonHttpSnapshotSource("http://127.0.0.1:1/snapshot", allow_loopback_http=True)
        state = {"schema_version": 1, "complete": True, "deletion_authoritative": False,
                 "documents": [{"schema_version": 1, "id": "policy", "title": "Policy",
                                "content": "Current policy", "acl": ["alex"]}]}
        source.endpoint.get = lambda *_: state
        with tempfile.TemporaryDirectory() as directory:
            runtime = SyncRuntime(str(Path(directory) / "runtime.sqlite3"), source)
            try:
                runtime.tick()
                self.assertEqual(len(runtime.retrieve("policy", "alex")["documents"]), 1)
                state["documents"] = []
                status = runtime.tick()
                self.assertEqual([document["id"] for document in status["documents"]], ["policy"])
                self.assertEqual(status["documents"][0]["blocked_reason"], "source_missing_or_no_longer_visible")
                self.assertEqual(runtime.retrieve("policy", "alex")["documents"], [])
            finally:
                runtime.close()

    def test_explicit_authoritative_inventory_can_remove_a_document(self):
        source = JsonHttpSnapshotSource("http://127.0.0.1:1/snapshot", allow_loopback_http=True)
        state = {"schema_version": 1, "complete": True, "deletion_authoritative": True,
                 "documents": [{"schema_version": 1, "id": "policy", "title": "Policy",
                                "content": "Current policy", "acl": ["alex"]}]}
        source.endpoint.get = lambda *_: state
        with tempfile.TemporaryDirectory() as directory:
            runtime = SyncRuntime(str(Path(directory) / "runtime.sqlite3"), source)
            try:
                runtime.tick()
                self.assertEqual(len(runtime.retrieve("policy", "alex")["documents"]), 1)
                state["documents"] = []
                status = runtime.tick()
                self.assertEqual(status["documents"], [])
                self.assertEqual(runtime.retrieve("policy", "alex")["documents"], [])
            finally:
                runtime.close()

    def test_api_deletion_authority_must_be_boolean_when_provided(self):
        source = JsonHttpSnapshotSource("http://127.0.0.1:1/snapshot", allow_loopback_http=True)
        for invalid in ["false", 0, 1, [], None]:
            with self.subTest(invalid=invalid):
                source.endpoint.get = lambda *_: {"schema_version": 1, "complete": True,
                                                  "documents": [], "deletion_authoritative": invalid}
                self.assertFalse(source.scan().complete)

    def test_slow_header_trickle_cannot_extend_whole_request_deadline(self):
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        listener.settimeout(2)
        port = listener.getsockname()[1]
        finished = threading.Event()

        def drip_headers():
            connection = None
            try:
                connection, _ = listener.accept()
                connection.settimeout(1)
                connection.recv(4096)
                connection.sendall(b"HTTP/1.1 200 OK\r\nX-Slow: ")
                for _ in range(30):
                    if finished.wait(.025):
                        return
                    connection.sendall(b"x")
                connection.sendall(b"\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}")
            except OSError:
                pass
            finally:
                if connection is not None:
                    connection.close()
                listener.close()

        thread = threading.Thread(target=drip_headers, daemon=True)
        thread.start()
        endpoint = _JsonEndpoint(f"http://127.0.0.1:{port}/snapshot",
                                 allow_loopback_http=True, timeout_seconds=.1)
        started = time.monotonic()
        try:
            with self.assertRaises(SourceError):
                endpoint.get()
            self.assertLess(time.monotonic() - started, .45,
                            "Socket inactivity timeout must not replace whole-request deadline")
        finally:
            finished.set()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
