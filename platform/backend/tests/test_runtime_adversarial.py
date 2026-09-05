"""Independent adversarial checks against the actual SQLite core, with source doubles."""
from __future__ import annotations

from dataclasses import replace
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

from concord.runtime import Snapshot, SourceDocument, SyncRuntime


def document(content='initial product value 100', acl=None):
    return SourceDocument('product', 'Product', content, content,
                          ['alex', 'jordan'] if acl is None else acl)


class Source:
    def __init__(self, docs=None):
        self.docs = docs if docs is not None else [document()]
        self.complete = True
        self.failure = None

    def scan(self):
        if self.failure:
            raise self.failure
        return Snapshot(self.docs, complete=self.complete)


class RuntimeAdversarial(unittest.TestCase):
    def setup_runtime(self, source=None, **kwargs):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        runtime = SyncRuntime(str(Path(root.name) / 'runtime.sqlite3'), source or Source(), **kwargs)
        self.addCleanup(runtime.close)
        return runtime

    def test_partial_source_preserves_rows_but_blocks_both_routes(self):
        source = Source([document(), replace(document(), id='other')])
        runtime = self.setup_runtime(source)
        runtime.tick()
        source.docs = [document()]
        source.complete = False
        result = runtime.tick()
        self.assertEqual(result['metrics']['documents'], 2)
        self.assertEqual(result['status'], 'degraded')
        for route in runtime.ROUTES:
            self.assertEqual(runtime.retrieve('product', 'alex', route)['documents'], [])

    def test_provider_exception_cannot_leak_secret(self):
        source = Source()
        runtime = self.setup_runtime(source)
        runtime.tick()
        source.failure = ValueError('Bearer SUPER-SECRET-TOKEN https://private-source.example')
        result = runtime.tick()
        self.assertNotIn('SUPER-SECRET', json.dumps(result))
        self.assertNotIn('private-source', json.dumps(result))
        self.assertEqual(result['status'], 'degraded')

    def test_unknown_acl_and_incompatible_schema_cannot_grant_reads(self):
        source = Source()
        runtime = self.setup_runtime(source)
        runtime.tick()
        source.docs = [replace(document(), acl=None)]
        result = runtime.tick()
        self.assertEqual(result['status'], 'blocked')
        self.assertTrue(all(j['state'] != 'verified' for j in result['jobs'] if j['operation'] == 'permission_update'))
        self.assertEqual(runtime.retrieve('product', 'alex', 'success')['documents'], [])
        source.docs = [replace(document(), schema_version=2)]
        result = runtime.tick()
        self.assertEqual(result['status'], 'degraded')
        self.assertEqual(runtime.retrieve('product', 'alex')['documents'], [])

    def test_tampered_cache_never_becomes_authority(self):
        runtime = self.setup_runtime()
        runtime.tick()
        wanted = runtime.retrieve('product', 'alex', 'success')['documents'][0]
        altered = {**wanted, 'content': 'malicious stale secret'}
        runtime._db.execute('UPDATE sync_response_cache SET payload_json=? WHERE identity=?',
                            (json.dumps(altered), 'alex'))
        actual = runtime.retrieve('product', 'alex', 'success')['documents'][0]
        self.assertEqual(actual, wanted)

    def test_namespaces_do_not_disclose_same_id_other_tenant(self):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        database = str(Path(root.name) / 'runtime.sqlite3')
        a = SyncRuntime(database, Source([document('tenant A secret')]), tenant_id='A')
        b = SyncRuntime(database, Source([document('tenant B secret')]), tenant_id='B')
        self.addCleanup(a.close)
        self.addCleanup(b.close)
        a.tick()
        b.tick()
        self.assertEqual(a.retrieve('secret', 'alex')['documents'][0]['content'], 'tenant A secret')
        self.assertEqual(b.retrieve('secret', 'alex')['documents'][0]['content'], 'tenant B secret')

    def test_expired_worker_cannot_overwrite_newer_worker(self):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        database = str(Path(root.name) / 'runtime.sqlite3')
        clock = [1000.0]
        newer = SyncRuntime(database, Source([document('new authoritative value')]), now=lambda: clock[0])
        self.addCleanup(newer.close)

        class SlowOldSource:
            first = True

            def scan(self):
                if self.first:
                    self.first = False
                    clock[0] += 301
                    newer.tick()
                return Snapshot([document('old delayed value')])

        older = SyncRuntime(database, SlowOldSource(), now=lambda: clock[0])
        self.addCleanup(older.close)
        older.tick()
        found = newer.retrieve('value', 'alex')['documents']
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]['content'], 'new authoritative value')


if __name__ == '__main__':
    unittest.main(verbosity=2)
