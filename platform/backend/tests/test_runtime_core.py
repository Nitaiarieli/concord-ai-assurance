"""Behavior tests use external file writes, restarted workers and injected faults."""
from dataclasses import replace
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest

from concord.runtime import Snapshot, SourceDocument, SyncRuntime


class FileSource:
    def __init__(self, path):
        self.path = path
        self.complete = True
        self.fail = False

    def scan(self):
        if self.fail:
            raise ValueError("Bearer SECRET-DO-NOT-EXPOSE")
        data = json.loads(self.path.read_text())
        return Snapshot([SourceDocument(**item) for item in data], complete=self.complete)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.source_file = self.root / "source.json"
        self.database = self.root / "concord.sqlite3"
        self.clock = 1000.0
        self.doc = dict(id="policy-1", title="Product policy", content="Refund policy allows 14 days.",
                        revision="one", acl=["alex", "jordan"], metadata={"folder": "support"})
        self.write(self.doc)
        self.source = FileSource(self.source_file)
        self.runtime = self.make_runtime()

    def tearDown(self):
        self.runtime.close()
        self.temporary.cleanup()

    def make_runtime(self, cls=SyncRuntime, source=None, **kwargs):
        return cls(str(self.database), source or self.source, now=lambda: self.clock, **kwargs)

    def write(self, *documents):
        self.source_file.write_text(json.dumps(documents))

    def contents(self, route="support", identity="alex"):
        return self.runtime.retrieve("policy", identity, route)["documents"]

    def test_external_edit_automatically_updates_both_real_local_routes(self):
        self.assertEqual(self.runtime.tick()["status"], "current")
        self.assertEqual(self.contents("success")[0]["revision"], "one")
        self.clock += 2
        self.write({**self.doc, "content": "Refund policy allows 30 days.", "revision": "two"})
        result = self.runtime.tick()
        self.assertEqual(result["status"], "current")
        for route in ("support", "success"):
            found = self.contents(route)[0]
            self.assertEqual(found["revision"], "two")
            self.assertIn("30 days", found["content"])
        self.assertEqual(result["metrics"]["observed_changes"], 2)

    def test_poll_catches_missed_notifications_and_same_revision_content_changes(self):
        self.runtime.tick()
        self.write({**self.doc, "content": "Refund policy allows 45 days."})
        self.runtime.tick()  # No notification, API change event or manual selection.
        self.assertIn("45 days", self.contents()[0]["content"])

    def test_restart_preserves_verified_index_and_durable_jobs(self):
        first = self.runtime.tick()
        self.runtime.close()
        self.runtime = self.make_runtime()
        self.assertEqual(self.contents()[0]["revision"], "one")
        self.assertEqual(self.runtime.status()["jobs"], first["jobs"])
        self.write({**self.doc, "revision": "after-restart", "content": "Updated policy"})
        self.assertEqual(self.runtime.tick()["status"], "current")
        self.assertEqual(self.contents()[0]["revision"], "after-restart")

    def test_partial_snapshot_does_not_delete_and_denies_uncertain_reads(self):
        self.runtime.tick()
        self.write()
        self.source.complete = False
        state = self.runtime.tick()
        self.assertEqual(state["metrics"]["documents"], 1)
        self.assertEqual(state["status"], "degraded")
        self.assertEqual(self.contents("success"), [])
        self.source.complete = True
        state = self.runtime.tick()
        self.assertEqual(state["status"], "current")
        self.assertEqual(state["metrics"]["documents"], 0)
        self.assertEqual(state["metrics"]["cached_documents"], 0)

    def test_connector_failure_redacts_secrets_and_prevents_cached_grants(self):
        self.runtime.tick()
        self.contents("success")
        self.source.fail = True
        state = self.runtime.tick()
        self.assertEqual(state["status"], "degraded")
        self.assertNotIn("SECRET", json.dumps(state))
        self.assertEqual(self.contents(), [])
        self.assertEqual(self.contents("success"), [])
        self.source.fail = False
        self.assertEqual(self.runtime.tick()["status"], "current")

    def test_acl_revoke_denies_cached_identity_but_preserves_other_identity(self):
        self.runtime.tick()
        self.contents("success", "alex")
        self.write({**self.doc, "acl": ["jordan"]})
        self.assertEqual(self.runtime.tick()["status"], "current")
        for route in ("support", "success"):
            self.assertEqual(self.contents(route, "alex"), [])
            self.assertEqual(len(self.contents(route, "jordan")), 1)

    def test_unknown_acl_denies_and_cannot_show_permission_ready(self):
        self.runtime.tick()
        self.write({**self.doc, "acl": None})
        state = self.runtime.tick()
        self.assertEqual(state["status"], "blocked")
        self.assertEqual(state["documents"][0]["blocked_reason"], "acl_unknown")
        self.assertIn("blocked", [job["state"] for job in state["jobs"]])
        self.assertEqual(self.contents(), [])

    def test_unsupported_schema_blocks_old_content_without_deleting_it(self):
        self.runtime.tick()
        self.write({**self.doc, "schema_version": 2})
        state = self.runtime.tick()
        self.assertEqual(state["status"], "degraded")
        self.assertEqual(state["metrics"]["documents"], 1)
        self.assertEqual(self.contents(), [])

    def test_structural_rename_rechunks_without_losing_stable_identity(self):
        self.runtime.tick()
        self.write({**self.doc, "title": "New product policy", "metadata": {"folder": "sales"},
                    "content": "policy " + "a" * 2500, "revision": "two"})
        state = self.runtime.tick()
        self.assertEqual(state["metrics"]["documents"], 1)
        self.assertEqual(state["metrics"]["chunks"], 3)
        self.assertIn("structure_update", [job["operation"] for job in state["jobs"]])
        self.assertEqual(self.contents()[0]["id"], "policy-1")

    def test_changed_source_during_apply_never_publishes_outdated_revision(self):
        self.runtime.tick()
        self.write({**self.doc, "revision": "two", "content": "policy two"})
        original = self.runtime._apply_document
        changed = False

        def race(document, fingerprint):
            nonlocal changed
            original(document, fingerprint)
            if not changed:
                changed = True
                self.write({**self.doc, "revision": "three", "content": "policy three"})

        self.runtime._apply_document = race
        state = self.runtime.tick()
        self.assertEqual(state["status"], "degraded")
        self.assertEqual(self.contents(), [])
        state = self.runtime.tick()
        self.assertEqual(state["status"], "current")
        self.assertEqual(self.contents()[0]["revision"], "three")
        self.assertEqual(state["metrics"]["failed_jobs"], 0)

    def test_failed_destination_verification_survives_restart_and_retries(self):
        self.runtime.tick()
        self.write({**self.doc, "revision": "two", "content": "policy changed"})
        self.runtime._verify_document = lambda *_: (_ for _ in ()).throw(RuntimeError("probe unavailable"))
        self.assertEqual(self.runtime.tick()["status"], "degraded")
        self.runtime.close()
        self.runtime = self.make_runtime()
        self.assertEqual(self.contents(), [])
        self.assertEqual(self.runtime.status()["metrics"]["failed_jobs"], 1)
        self.assertEqual(self.runtime.tick()["status"], "current")
        self.assertEqual(self.contents()[0]["revision"], "two")

    def test_unchanged_source_still_detects_a_failed_registered_route(self):
        self.runtime.tick()
        original = self.runtime.retrieve

        def unavailable(query, identity, route="support", **kwargs):
            result = original(query, identity, route, **kwargs)
            if route == "success":
                result["documents"] = []
            return result

        self.runtime.retrieve = unavailable
        self.assertEqual(self.runtime.tick()["status"], "degraded")

    def test_cache_tampering_cannot_bypass_current_index_and_acl(self):
        self.runtime.tick()
        with sqlite3.connect(self.database) as db:
            db.execute("UPDATE sync_response_cache SET payload_json=?", (json.dumps({"content": "stolen content"}),))
        self.assertEqual(self.contents("success")[0]["content"], self.doc["content"])

    def test_index_drift_is_repaired_without_a_source_event(self):
        self.runtime.tick()
        with sqlite3.connect(self.database) as db:
            db.execute("UPDATE sync_chunks SET content='corrupted'")
        state = self.runtime.tick()
        self.assertEqual(state["status"], "current")
        self.assertEqual(self.contents()[0]["content"], self.doc["content"])

    def test_freshness_budget_expires_even_without_further_ticks(self):
        self.runtime.tick()
        self.clock += 61
        self.assertEqual(self.runtime.status()["status"], "degraded")
        self.assertEqual(self.contents("success"), [])

    def test_duplicate_ids_and_limits_never_infer_deletion(self):
        self.runtime.tick()
        self.write(self.doc, self.doc)
        state = self.runtime.tick()
        self.assertEqual(state["status"], "degraded")
        self.assertEqual(state["metrics"]["documents"], 1)
        self.write({**self.doc, "content": "x" * (1024 * 1024 + 1)})
        self.assertEqual(self.runtime.tick()["status"], "degraded")

    def test_source_namespaces_do_not_share_docs_cache_or_lease(self):
        self.runtime.tick()
        other = self.make_runtime(connection_id="another", source=type("Empty", (), {"scan": lambda _: Snapshot([])})())
        try:
            self.assertEqual(other.tick()["metrics"]["documents"], 0)
            self.assertEqual(other.retrieve("policy", "alex")["documents"], [])
            self.assertEqual(len(self.contents()), 1)
        finally:
            other.close()

    def test_status_contains_metadata_not_raw_source_content(self):
        result = self.runtime.tick()
        self.assertNotIn(self.doc["content"], json.dumps(result))
        self.assertNotIn("content", result["documents"][0])

    def test_close_is_idempotent_and_prevents_further_work(self):
        self.runtime.close()
        self.runtime.close()
        with self.assertRaises(RuntimeError):
            self.runtime.tick()

    def test_threads_serialize_tick_and_retrieval(self):
        errors = []

        def tick():
            try:
                self.runtime.tick()
            except Exception as error:
                errors.append(error)

        threads = [threading.Thread(target=tick) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(errors, [])
        self.assertEqual(self.runtime.status()["metrics"]["observed_changes"], 1)
        self.assertEqual(self.contents()[0]["revision"], "one")


if __name__ == "__main__":
    unittest.main()
