"""Jira status extraction and real HTTP-to-retrieval regression coverage."""
from pathlib import Path
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit

from concord.runtime.atlassian import JiraCloudSource
from concord.runtime.core import SyncRuntime
from test_runtime_atlassian import OPTIONS, fixture, issue


class JiraStatusTests(unittest.TestCase):
    def test_status_only_change_updates_direct_and_cached_retrieval(self):
        state = {"status": "In Progress"}

        def reply(*_):
            value = issue()
            # Deliberately keep title, description and provider updated timestamp
            # identical: the status field itself must invalidate the old document.
            value["fields"]["status"] = {"name": state["status"]}
            return 200, {"issues": [value], "isLast": True}, {}

        with fixture(reply) as (url, calls), tempfile.TemporaryDirectory() as directory:
            source = JiraCloudSource(url, ["CON"], operator_declared_access=True,
                                     allowed_identities=["alex"], **OPTIONS)
            runtime = SyncRuntime(str(Path(directory) / "state.sqlite"), source)
            try:
                runtime.tick()
                before = runtime.retrieve("support", "alex", route="success")["documents"][0]
                self.assertIn("Status: In Progress", before["content"])
                state["status"] = "Done"
                runtime.tick()
                for route in ("support", "success"):
                    with self.subTest(route=route):
                        after = runtime.retrieve("support", "alex", route=route)["documents"][0]
                        self.assertIn("Status: Done", after["content"])
                        self.assertNotIn("In Progress", after["content"])
                        self.assertNotEqual(before["revision"], after["revision"])
                snapshot = source.scan()
                self.assertEqual(snapshot.documents[0].metadata["status_name"], "Done")
                self.assertEqual(snapshot.documents[0].metadata["status_coverage"], "returned")
                self.assertTrue(all("status" in parse_qs(urlsplit(call["path"]).query)["fields"][0].split(",")
                                    for call in calls))
            finally:
                runtime.close()

    def test_missing_status_records_coverage_gap_without_fabrication(self):
        with fixture(lambda *_: (200, {"issues": [issue()], "isLast": True}, {})) as (url, _):
            snapshot = JiraCloudSource(url, ["CON"], **OPTIONS).scan()
        self.assertTrue(snapshot.complete)
        self.assertEqual(snapshot.documents[0].metadata["status_coverage"], "not_returned")
        self.assertIsNone(snapshot.documents[0].metadata["status_name"])
        self.assertNotIn("Status:", snapshot.documents[0].content)

    def test_returned_invalid_status_makes_scan_incomplete(self):
        for status in (None, "Done", {}, {"name": ""}, {"name": ["Done"]}, {"name": "Done\nInjected"}):
            with self.subTest(status=status):
                value = issue()
                value["fields"]["status"] = status
                with fixture(lambda *_: (200, {"issues": [value], "isLast": True}, {})) as (url, _):
                    snapshot = JiraCloudSource(url, ["CON"], **OPTIONS).scan()
                self.assertFalse(snapshot.complete)
                self.assertEqual(snapshot.documents, [])


if __name__ == "__main__":
    unittest.main()
