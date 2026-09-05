"""Network contract tests against a loopback fixture, never live Atlassian."""
import json
import os
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from concord.runtime.atlassian import ConfluenceCloudSource, JiraCloudSource
from concord.runtime.atlassian_config import normalize_atlassian_source
from concord.runtime.core import SyncRuntime


def page(identity="101", content="<p>The plan includes 30 days of support.</p>", version=1):
    return {"id": identity, "spaceId": "10", "status": "current", "title": "Support policy",
            "version": {"number": version}, "body": {"storage": {"value": content}}}


def issue(identity="201", project="CON", description=None):
    return {"id": identity, "key": project + "-1", "fields": {"project": {"key": project},
        "summary": "Support policy", "updated": "2026-09-05T12:00:00Z",
        "description": description if description is not None else {"version": 1, "type": "doc", "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Support lasts 30 days."}]}]}}}


@contextmanager
def fixture(callback):
    calls = []
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            calls.append({"path": self.path, "authorization": self.headers.get("Authorization")})
            status, value, headers = callback(self.path, len(calls))
            raw = json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            for key, val in headers.items():
                self.send_header(key, val)
            self.end_headers()
            self.wfile.write(raw)
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=.01), daemon=True)
    thread.start()
    try:
        with patch.dict(os.environ, {"CONCORD_TEST_OAUTH_TOKEN": "fixture-secret"}):
            yield f"http://127.0.0.1:{server.server_port}", calls
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


OPTIONS = {"token_env": "CONCORD_TEST_OAUTH_TOKEN", "allow_loopback_http": True}


class AtlassianContractTests(unittest.TestCase):
    def test_confluence_pagination_preserves_scope_and_strips_script(self):
        def reply(path, call):
            if call == 1:
                return 200, {"results": [page(content="<p>Policy</p><script>secret()</script>")],
                             "_links": {"next": "/wiki/api/v2/pages?cursor=next&space-id=999"}}, {}
            return 200, {"results": [page("102")], "_links": {}}, {}
        with fixture(reply) as (url, calls):
            snapshot = ConfluenceCloudSource(url, space_ids=["10"], **OPTIONS).scan()
        self.assertTrue(snapshot.complete)
        self.assertFalse(snapshot.deletion_authoritative)
        self.assertEqual(len(snapshot.documents), 2)
        self.assertNotIn("secret", snapshot.documents[0].content)
        self.assertIsNone(snapshot.documents[0].acl)
        self.assertEqual(parse_qs(urlsplit(calls[1]["path"]).query)["space-id"], ["10"])
        self.assertEqual(calls[0]["authorization"], "Bearer fixture-secret")

    def test_confluence_explicit_page_scope(self):
        with fixture(lambda *_: (200, {"results": [page()], "_links": {}}, {})) as (url, calls):
            snapshot = ConfluenceCloudSource(url, page_ids=[101], **OPTIONS).scan()
        self.assertTrue(snapshot.complete)
        self.assertEqual(parse_qs(urlsplit(calls[0]["path"]).query)["id"], ["101"])

    def test_confluence_cross_origin_next_link_never_requested(self):
        body = {"results": [page()], "_links": {"next": "https://other.example/wiki/api/v2/pages?cursor=leak"}}
        with fixture(lambda *_: (200, body, {})) as (url, calls):
            result = ConfluenceCloudSource(url, space_ids=["10"], **OPTIONS).scan()
        self.assertFalse(result.complete)
        self.assertEqual(len(calls), 1)
        self.assertNotIn("fixture-secret", result.error)

    def test_redirect_refused(self):
        with fixture(lambda *_: (302, {}, {"Location": "https://other.example"})) as (url, calls):
            result = ConfluenceCloudSource(url, space_ids=["10"], **OPTIONS).scan()
        self.assertFalse(result.complete)
        self.assertEqual(len(calls), 1)

    def test_partial_second_page_preserves_observations_but_incomplete(self):
        def reply(path, call):
            if call == 1:
                return 200, {"results": [page()], "_links": {"next": "?cursor=next"}}, {}
            return 429, {"message": "fixture-secret"}, {}
        with fixture(reply) as (url, _):
            result = ConfluenceCloudSource(url, space_ids=["10"], **OPTIONS).scan()
        self.assertFalse(result.complete)
        self.assertEqual(len(result.documents), 1)
        self.assertNotIn("fixture-secret", result.error)

    def test_confluence_repeated_cursor_and_document_limits(self):
        def reply(path, call):
            return 200, {"results": [page(str(100 + call))], "_links": {"next": "?cursor=repeat"}}, {}
        for options in ({}, {"max_documents": 1}, {"max_pages": 1}):
            with self.subTest(options=options), fixture(reply) as (url, calls):
                result = ConfluenceCloudSource(url, space_ids=["10"], **OPTIONS, **options).scan()
                self.assertFalse(result.complete)
                self.assertLessEqual(len(calls), 2)

    def test_confluence_invalid_body_and_out_of_scope_rejected(self):
        for value in (page("999"), page() | {"body": {}}, page() | {"status": "draft"}):
            with self.subTest(value=value), fixture(lambda *_: (200, {"results": [value], "_links": {}}, {})) as (url, _):
                self.assertFalse(ConfluenceCloudSource(url, page_ids=[101], **OPTIONS).scan().complete)

    def test_atlassian_requires_explicit_access_declaration(self):
        url = "https://api.atlassian.com/ex/confluence/cloud-id"
        with self.assertRaises(ValueError):
            ConfluenceCloudSource(url, space_ids=[10], allowed_identities=["alex"])
        with self.assertRaises(ValueError):
            ConfluenceCloudSource(url, space_ids=[10], operator_declared_access=True)
        with fixture(lambda *_: (200, {"results": [page()], "_links": {}}, {})) as (url, _):
            result = ConfluenceCloudSource(url, space_ids=[10], operator_declared_access=True,
                                           allowed_identities=["alex"], **OPTIONS).scan()
        self.assertEqual(result.documents[0].acl, ["alex"])
        self.assertEqual(result.documents[0].metadata["effective_authorization"], "unknown")
        self.assertEqual(result.documents[0].metadata["acl_basis"], "operator_declaration")

    def test_jira_current_endpoint_and_opaque_pagination(self):
        def reply(path, call):
            return (200, {"issues": [issue(str(200 + call))], "isLast": call == 2,
                          **({"nextPageToken": "opaque+/="} if call == 1 else {})}, {})
        with fixture(reply) as (url, calls):
            result = JiraCloudSource(url, ["CON"], **OPTIONS).scan()
        self.assertTrue(result.complete)
        self.assertFalse(result.deletion_authoritative)
        self.assertEqual(result.documents[0].content, "Support lasts 30 days.")
        self.assertTrue(all(urlsplit(call["path"]).path == "/rest/api/3/search/jql" for call in calls))
        self.assertEqual(parse_qs(urlsplit(calls[1]["path"]).query)["nextPageToken"], ["opaque+/="])
        self.assertIsNone(result.documents[0].acl)

    def test_jira_malformed_legacy_pagination_is_incomplete(self):
        with fixture(lambda *_: (200, {"issues": [issue()], "startAt": 0, "total": 1}, {})) as (url, _):
            self.assertFalse(JiraCloudSource(url, ["CON"], **OPTIONS).scan().complete)

    def test_jira_repeat_token_and_out_of_scope_are_incomplete(self):
        for reply in (lambda path, call: (200, {"issues": [issue(str(200 + call))], "isLast": False, "nextPageToken": "again"}, {}),
                      lambda *_: (200, {"issues": [issue(project="OTHER")], "isLast": True}, {})):
            with fixture(reply) as (url, calls):
                self.assertFalse(JiraCloudSource(url, ["CON"], **OPTIONS).scan().complete)
                self.assertLessEqual(len(calls), 2)

    def test_jira_unknown_embedded_nodes_are_recorded_and_never_fetched(self):
        description = {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [
            {"type": "text", "text": "Policy"}, {"type": "inlineCard", "attrs": {"url": "https://other.example"}}]}]}
        with fixture(lambda *_: (200, {"issues": [issue(description=description)], "isLast": True}, {})) as (url, calls):
            result = JiraCloudSource(url, ["CON"], **OPTIONS).scan()
        self.assertTrue(result.complete)
        self.assertEqual(result.documents[0].metadata["omitted_adf_node_types"], ["inlineCard"])
        self.assertEqual(len(calls), 1)

    def test_missing_token_does_not_make_request(self):
        with fixture(lambda *_: (200, {}, {})) as (url, calls):
            source = JiraCloudSource(url, ["CON"], token_env="CONCORD_TOKEN_NOT_SET", allow_loopback_http=True)
            with patch.dict(os.environ, {}, clear=True):
                result = source.scan()
        self.assertFalse(result.complete)
        self.assertEqual(calls, [])

    def test_oversized_response_is_incomplete(self):
        with fixture(lambda *_: (200, {"results": [page()], "_links": {}}, {})) as (url, _):
            result = ConfluenceCloudSource(url, space_ids=[10], max_bytes=50, **OPTIONS).scan()
        self.assertFalse(result.complete)

    def test_strict_configuration_rejects_arbitrary_origins_and_unknown_fields(self):
        valid = {"type": "confluence_cloud", "base_url": "https://api.atlassian.com/ex/confluence/cloud-id/", "space_ids": [10]}
        self.assertEqual(normalize_atlassian_source(valid)["space_ids"], ["10"])
        for updates in ({"base_url": "https://example.com"}, {"base_url": "http://api.atlassian.com/ex/confluence/id"},
                        {"password": "unsupported"}, {"space_ids": {}}, {"max_pages": 100000}, {"token_env": "not-a-name"}):
            with self.subTest(updates=updates), self.assertRaises((ValueError, TypeError)):
                normalize_atlassian_source(valid | updates)

    def test_real_http_observation_drives_index_then_missing_blocks_without_delete(self):
        state = {"present": True, "text": "The plan includes 30 days of support.", "version": 1}
        def reply(*_):
            return 200, {"results": [page(content="<p>" + state["text"] + "</p>", version=state["version"])] if state["present"] else [], "_links": {}}, {}
        with fixture(reply) as (url, _), tempfile.TemporaryDirectory() as directory:
            source = ConfluenceCloudSource(url, space_ids=[10], operator_declared_access=True,
                                           allowed_identities=["alex"], **OPTIONS)
            runtime = SyncRuntime(str(Path(directory) / "state.sqlite"), source)
            try:
                runtime.tick()
                self.assertEqual(len(runtime.retrieve("support", "alex")["documents"]), 1)
                state["text"] = "The plan includes 90 days of support."
                state["version"] = 2
                runtime.tick()
                self.assertIn("90 days", runtime.retrieve("support", "alex")["documents"][0]["content"])
                state["present"] = False
                status = runtime.tick()
                self.assertEqual(runtime.retrieve("support", "alex")["documents"], [])
                self.assertEqual(len(status["documents"]), 1)
                self.assertEqual(status["documents"][0]["blocked_reason"], "source_missing_or_no_longer_visible")
                state["present"] = True
                runtime.tick()
                self.assertEqual(len(runtime.retrieve("support", "alex")["documents"]), 1)
            finally:
                runtime.close()


if __name__ == "__main__":
    unittest.main()
