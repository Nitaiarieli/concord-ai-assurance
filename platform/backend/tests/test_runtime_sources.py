"""Source boundary tests using real files and a loopback HTTP server only."""
import json
import os
import tempfile
import threading
import time
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from concord.runtime.sources import BookStackSource, FilesystemSource, JsonHttpSnapshotSource


def document(**changes):
    result = {"id": "terms", "title": "Terms", "content": "Current terms", "acl": ["alex"], "schema_version": 1}
    result.update(changes)
    return result


def snapshot(**changes):
    result = {"schema_version": 1, "complete": True, "documents": [document()]}
    result.update(changes)
    return result


@contextmanager
def http_server(routes):
    """routes(path) -> status, headers, bytes; requests retained for assertions."""
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append({"path": self.path, "authorization": self.headers.get("Authorization")})
            status, headers, body = routes(self.path)
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": .01}, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def response(value, status=200, **headers):
    body = value if isinstance(value, bytes) else json.dumps(value).encode()
    return status, {"Content-Type": "application/json", "Content-Length": str(len(body)), **headers}, body


class FilesystemSourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, path, value):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value if isinstance(value, str) else json.dumps(value), encoding="utf-8")
        return target

    def test_discovers_nested_markdown_and_json_without_manual_event(self):
        self.write("nested/guide.md", "# Guide\nFirst content")
        self.write("terms.json", document())
        self.write("ignored.csv", "not in scope")
        self.write(".hidden/secret.md", "hidden is excluded")
        source = FilesystemSource(self.root, identities=["alex", "jordan"])
        first = source.scan()
        self.assertTrue(first.complete)
        self.assertEqual({d.id for d in first.documents}, {"file:nested/guide.md", "terms"})
        self.assertEqual(first.documents[0].acl, ["alex", "jordan"])
        self.write("nested/guide.md", "# Guide\nUpdated automatically on next scan")
        second = source.scan()
        self.assertTrue(second.complete)
        self.assertNotEqual(first.cursor, second.cursor)
        self.assertIn("Updated automatically", second.documents[0].content)

    def test_unknown_and_deny_all_acl_are_distinct(self):
        self.write("guide.md", "# Guide")
        self.write("deny.json", document(id="deny", acl=[]))
        result = FilesystemSource(self.root).scan()
        self.assertTrue(result.complete)
        self.assertEqual(result.documents[0].acl, [])
        self.assertIsNone(result.documents[1].acl)

    def test_markdown_rename_uses_new_relative_path_identity(self):
        old = self.write("old.md", "# Same content")
        first = FilesystemSource(self.root).scan()
        old.rename(self.root / "new.md")
        second = FilesystemSource(self.root).scan()
        self.assertEqual(first.documents[0].id, "file:old.md")
        self.assertEqual(second.documents[0].id, "file:new.md")
        self.assertTrue(second.complete)

    def test_json_stable_identity_survives_filename_change(self):
        old = self.write("old.json", document())
        first = FilesystemSource(self.root).scan()
        old.rename(self.root / "new.json")
        second = FilesystemSource(self.root).scan()
        self.assertEqual(first.documents[0].id, second.documents[0].id)

    def test_any_invalid_file_makes_snapshot_incomplete(self):
        for value in ["not json", '{"id":"a","id":"b"}', document(schema_version=2), document(acl="alex")]:
            with self.subTest(value=value):
                self.write("broken.json", value)
                result = FilesystemSource(self.root).scan()
                self.assertFalse(result.complete)
                self.assertTrue(result.error)
                self.assertIsNone(result.cursor)

    def test_missing_acl_is_rejected_not_assumed_public(self):
        value = document()
        del value["acl"]
        self.write("broken.json", value)
        self.assertFalse(FilesystemSource(self.root).scan().complete)

    def test_json_identity_collision_rejects_whole_scan(self):
        self.write("a.json", document())
        self.write("b.json", document(content="Different content with the same id"))
        result = FilesystemSource(self.root).scan()
        self.assertFalse(result.complete)
        self.assertIn("Duplicate", result.error)

    def test_symlink_files_and_directories_are_never_followed(self):
        with tempfile.TemporaryDirectory() as outside:
            external = Path(outside) / "secret.md"
            external.write_text("outside secret", encoding="utf-8")
            for target in [external, Path(outside)]:
                with self.subTest(target=target):
                    link = self.root / "escape.md"
                    link.symlink_to(target)
                    result = FilesystemSource(self.root).scan()
                    self.assertFalse(result.complete)
                    self.assertEqual(result.documents, [])
                    link.unlink()

    def test_configured_root_symlink_is_rejected(self):
        link = self.root / "alias"
        actual = self.root / "actual"
        actual.mkdir()
        link.symlink_to(actual)
        self.assertFalse(FilesystemSource(link).scan().complete)

    def test_limits_and_unreadable_source_are_incomplete(self):
        self.write("a.md", "a" * 20)
        self.assertFalse(FilesystemSource(self.root, max_bytes=10).scan().complete)
        self.write("b.md", "b")
        self.assertFalse(FilesystemSource(self.root, max_files=1).scan().complete)
        self.assertFalse(FilesystemSource(self.root, max_total_bytes=10).scan().complete)
        self.assertFalse(FilesystemSource(self.root / "missing").scan().complete)
        with patch("concord.runtime.sources.os.scandir", side_effect=PermissionError):
            self.assertFalse(FilesystemSource(self.root).scan().complete)

    def test_non_regular_source_file_does_not_block_open(self):
        if not hasattr(os, "mkfifo"):
            self.skipTest("POSIX fifo test")
        os.mkfifo(self.root / "stream.md")
        started = time.monotonic()
        self.assertFalse(FilesystemSource(self.root).scan().complete)
        self.assertLess(time.monotonic() - started, 1)


class HttpSourceTests(unittest.TestCase):
    def test_complete_snapshot_with_env_credentials(self):
        with http_server(lambda _path: response(snapshot(cursor="v1"))) as (url, requests):
            with patch.dict(os.environ, {"CONCORD_TEST_TOKEN": "local-test-token"}):
                result = JsonHttpSnapshotSource(url + "/snapshot", token_env="CONCORD_TEST_TOKEN",
                                               allow_loopback_http=True).scan()
            self.assertTrue(result.complete)
            self.assertEqual(result.cursor, "v1")
            self.assertEqual(result.documents[0].acl, ["alex"])
            self.assertEqual(requests[0]["authorization"], "Bearer local-test-token")

    def test_defaults_require_https_and_no_userinfo(self):
        for url in ["http://127.0.0.1/data", "http://localhost/data", "https://name:password@example.com/data"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                JsonHttpSnapshotSource(url)
        with self.assertRaises(ValueError):
            JsonHttpSnapshotSource("http://example.com/data", allow_loopback_http=True)

    def test_redirect_is_not_followed_or_sent_credentials(self):
        def routes(path):
            return response(b"", status=302, Location="/other") if path == "/snapshot" else response(snapshot())
        with http_server(routes) as (url, requests):
            with patch.dict(os.environ, {"CONCORD_TEST_TOKEN": "not-to-forward"}):
                result = JsonHttpSnapshotSource(url + "/snapshot", token_env="CONCORD_TEST_TOKEN",
                                               allow_loopback_http=True).scan()
            self.assertFalse(result.complete)
            self.assertEqual([r["path"] for r in requests], ["/snapshot"])
            self.assertNotIn("not-to-forward", result.error)

    def test_truncated_content_length_is_not_complete_even_with_valid_json(self):
        body = json.dumps(snapshot()).encode()
        with http_server(lambda _path: response(body, **{"Content-Length": str(len(body) + 10)})) as (url, _):
            result = JsonHttpSnapshotSource(url, allow_loopback_http=True).scan()
            self.assertFalse(result.complete)
            self.assertIn("truncated", result.error)

    def test_bad_snapshot_contracts_are_incomplete(self):
        for payload in [snapshot(complete="true"), snapshot(schema_version=True), snapshot(schema_version=2),
                        snapshot(documents=[document(), document()]), snapshot(complete=False),
                        snapshot(error="sensitive producer error not echoed")]:
            with self.subTest(payload=payload), http_server(lambda _path: response(payload)) as (url, _):
                result = JsonHttpSnapshotSource(url, allow_loopback_http=True).scan()
                self.assertFalse(result.complete)
                self.assertIsNone(result.cursor)
                self.assertNotIn("sensitive producer error", result.error)

    def test_missing_complete_marker_is_not_assumed_complete(self):
        payload = snapshot()
        del payload["complete"]
        with http_server(lambda _path: response(payload)) as (url, _):
            self.assertFalse(JsonHttpSnapshotSource(url, allow_loopback_http=True).scan().complete)

    def test_oversized_or_unsupported_responses_are_rejected(self):
        replies = [response(b" " * 200), response(snapshot(), **{"Content-Type": "text/html"}),
                   response(snapshot(), **{"Content-Encoding": "gzip"}), response(b"{", status=403)]
        for reply in replies:
            with self.subTest(reply=reply), http_server(lambda _path: reply) as (url, _):
                result = JsonHttpSnapshotSource(url, allow_loopback_http=True, max_bytes=100).scan()
                self.assertFalse(result.complete)

    def test_missing_secret_and_header_injection_never_send_request(self):
        with http_server(lambda _path: response(snapshot())) as (url, requests):
            for value in [None, "abc\r\nInjected: secret"]:
                with patch.dict(os.environ, {}, clear=True):
                    if value is not None:
                        os.environ["CONCORD_TEST_TOKEN"] = value
                    result = JsonHttpSnapshotSource(url, token_env="CONCORD_TEST_TOKEN",
                                                   allow_loopback_http=True).scan()
                self.assertFalse(result.complete)
            self.assertEqual(requests, [])


class BookStackSourceTests(unittest.TestCase):
    def page(self, **changes):
        value = {"id": 7, "name": "Guide", "html": "<p>Current guide</p>",
                 "updated_at": "2026-09-05T12:00:00Z", "book_id": 1, "chapter_id": None}
        value.update(changes)
        return value

    def test_page_content_is_polled_and_acl_stays_unknown(self):
        value = self.page()
        with http_server(lambda _path: response(value)) as (url, requests), patch.dict(
                os.environ, {"BOOKSTACK_TOKEN_ID": "test-id", "BOOKSTACK_TOKEN_SECRET": "test-secret"}):
            source = BookStackSource(url, [7], allow_loopback_http=True)
            first = source.scan()
            value["html"] = "<p>New included content</p><script>alert('not content')</script>"
            second = source.scan()
            self.assertTrue(first.complete)
            self.assertTrue(second.complete)
            self.assertIsNone(second.documents[0].acl)
            self.assertEqual(second.documents[0].metadata["effective_authorization"], "unknown")
            self.assertEqual(second.documents[0].content, "New included content")
            self.assertNotEqual(first.documents[0].revision, second.documents[0].revision)
            self.assertEqual(requests[0]["path"], "/api/pages/7")
            self.assertEqual(requests[0]["authorization"], "Token test-id:test-secret")

    def test_missing_or_forbidden_page_is_incomplete_not_deletion(self):
        for status in [403, 404, 429]:
            with self.subTest(status=status), http_server(lambda path: response(
                    self.page() if path.endswith("/7") else {}, status=200 if path.endswith("/7") else status)) as (url, _), patch.dict(
                    os.environ, {"BOOKSTACK_TOKEN_ID": "test-id", "BOOKSTACK_TOKEN_SECRET": "test-secret"}):
                result = BookStackSource(url, [7, 8], allow_loopback_http=True).scan()
                self.assertFalse(result.complete)
                self.assertEqual(len(result.documents), 1)
                self.assertIsNone(result.cursor)
                self.assertIn("no deletion inferred", result.error)

    def test_public_mode_requires_explicit_named_identity_declaration(self):
        with self.assertRaises(ValueError):
            BookStackSource("https://example.com", [7], public_identities=["alex"])
        with self.assertRaises(ValueError):
            BookStackSource("https://example.com", [7], public_content=True)
        with self.assertRaises(ValueError):
            BookStackSource("https://example.com", [7], public_content=True, public_identities=["*"])
        with http_server(lambda _path: response(self.page())) as (url, _), patch.dict(
                os.environ, {"BOOKSTACK_TOKEN_ID": "test-id", "BOOKSTACK_TOKEN_SECRET": "test-secret"}):
            result = BookStackSource(url, [7], public_content=True, public_identities=["alex"],
                                    allow_loopback_http=True).scan()
            self.assertTrue(result.complete)
            self.assertEqual(result.documents[0].acl, ["alex"])
            self.assertEqual(result.documents[0].metadata["acl_basis"], "operator_declared_public_content")
            self.assertEqual(result.documents[0].metadata["effective_authorization"], "unknown")

    def test_unexpected_page_identity_is_rejected(self):
        with http_server(lambda _path: response(self.page(id=99))) as (url, _), patch.dict(
                os.environ, {"BOOKSTACK_TOKEN_ID": "test-id", "BOOKSTACK_TOKEN_SECRET": "test-secret"}):
            self.assertFalse(BookStackSource(url, [7], allow_loopback_http=True).scan().complete)

    def test_aggregate_page_deadline_limits_entire_scan(self):
        def routes(path):
            time.sleep(.06)
            return response(self.page(id=int(path.rsplit("/", 1)[1])))
        with http_server(routes) as (url, _), patch.dict(
                os.environ, {"BOOKSTACK_TOKEN_ID": "test-id", "BOOKSTACK_TOKEN_SECRET": "test-secret"}):
            source = BookStackSource(url, [7, 8, 9], allow_loopback_http=True,
                                    timeout_seconds=1, max_scan_seconds=.1)
            started = time.monotonic()
            result = source.scan()
            self.assertFalse(result.complete)
            self.assertLess(time.monotonic() - started, .5)


if __name__ == "__main__":
    unittest.main()
