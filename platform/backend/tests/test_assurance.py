import unittest
from copy import deepcopy
from tempfile import TemporaryDirectory
from concord.demo import build_demo
from concord.domain.models import Artifact, Conflict
from concord.domain.graph import Lineage
from concord.application.engine import AssuranceEngine
from concord.adapters.local_index import LocalIndex
from concord.adapters.sqlite_store import SQLiteStateStore
from concord.adapters.bookstack import BookStackConnector
from concord.adapters.qdrant import QdrantAdapter
from concord.api.server import validate_command

class AssuranceTests(unittest.TestCase):
    def setUp(self):
        self.engine=build_demo()

    def change(self, kind='permission', key='request-1'):
        return self.engine.detect('src-forecast',kind,'alex',key)['id']

    def finish(self, event):
        self.engine.repair(event)
        return self.engine.verify(event)

    def test_revocation_contains_repairs_then_verifies_both_identities(self):
        event=self.change()
        self.assertFalse(self.engine.retrieve('memory-forecast','alex')['allowed'])
        self.assertFalse(self.engine.retrieve('memory-forecast','jordan')['allowed'])
        self.assertTrue(self.engine.retrieve('memory-policy','jordan')['allowed'])
        self.engine.repair(event)
        self.assertFalse(self.engine.retrieve('memory-forecast','jordan')['allowed'])
        proof=self.engine.verify(event)
        self.assertEqual(proof['result'],'verified')
        self.assertFalse(self.engine.retrieve('memory-forecast','alex')['allowed'])
        self.assertTrue(self.engine.retrieve('memory-forecast','jordan')['allowed'])
        self.assertTrue(any(c['check']=='unaffected_positive_control' for c in proof['checks']))

    def test_content_update_does_not_touch_unrelated_destinations(self):
        original=deepcopy(self.engine.destination.records['memory-policy'])
        proof=self.finish(self.change('content'))
        result=self.engine.retrieve('memory-forecast','alex')
        self.assertIn('revision 2',result['content'])
        self.assertNotIn('$2.4',result['content'])
        self.assertEqual(proof['affected'],['chunk-forecast','index-forecast','memory-forecast'])
        self.assertEqual(original,self.engine.destination.records['memory-policy'])

    def test_deletion_removes_all_affected_destination_records(self):
        proof=self.finish(self.change('deletion'))
        for key in proof['affected']:
            self.assertIsNone(self.engine.destination.read(key))
            self.assertFalse(self.engine.retrieve(key,'jordan')['allowed'])

    def test_unreachable_probe_never_releases(self):
        proof=self.finish(self.change('probe_failure'))
        self.assertEqual(proof['result'],'unverified')
        self.assertEqual(self.engine.snapshot()['counts']['blocked'],3)
        self.assertFalse(self.engine.retrieve('memory-forecast','jordan')['allowed'])

    def test_unknown_authorization_is_not_success(self):
        event=self.change('content')
        self.engine.artifacts['src-forecast'].acl=None
        proof=self.finish(event)
        self.assertEqual(proof['result'],'unverified')
        self.assertTrue(any(c['check']=='source_authority_known' and not c['passed'] for c in proof['checks']))

    def test_idempotency_and_payload_conflict(self):
        first=self.change()
        second=self.change()
        self.assertEqual(first,second)
        self.assertEqual(self.engine.epoch,1)
        with self.assertRaises(Conflict):self.change('content')

    def test_stale_event_cannot_repair_newer_revision(self):
        old=self.change('content')
        self.change('permission','request-2')
        with self.assertRaises(Conflict):self.engine.repair(old)
        self.assertEqual(self.engine.snapshot()['counts']['blocked'],3)

    def test_multi_parent_newer_containment_wins(self):
        nodes={'a':Artifact('a','A','source',acl=['alex','jordan'],content='A'),
               'b':Artifact('b','B','source',acl=['alex','jordan'],content='B'),
               'm':Artifact('m','M','memory',parents=['a','b'])}
        e=AssuranceEngine(nodes,LocalIndex())
        old=e.detect('a','content','alex','one')['id']
        e.detect('b','probe_failure','alex','two')
        with self.assertRaises(Conflict):e.repair(old)
        self.assertFalse(e.retrieve('m','jordan')['allowed'])

    def test_silent_write_failure_fails_readback(self):
        event=self.change()
        self.engine.destination.write=lambda *args:None
        proof=self.finish(event)
        self.assertEqual(proof['result'],'unverified')
        self.assertFalse(self.engine.retrieve('memory-forecast','jordan')['allowed'])

    def test_destination_content_tampering_after_release_denies(self):
        self.engine.destination.records['memory-forecast']['content']='tampered'
        result=self.engine.retrieve('memory-forecast','alex')
        self.assertFalse(result['allowed'])
        self.assertEqual(result['reason'],'Destination integrity mismatch')

    def test_exception_during_protected_probe_recontains(self):
        event=self.change()
        self.engine.repair(event)
        real=self.engine.destination.retrieve
        calls=0
        def broken(*args):
            nonlocal calls
            calls+=1
            if calls==7:raise RuntimeError('probe unavailable')
            return real(*args)
        self.engine.destination.retrieve=broken
        with self.assertRaises(RuntimeError):self.engine.verify(event)
        self.assertEqual(self.engine.snapshot()['counts']['blocked'],3)
        self.assertEqual(self.engine.events[event].stage,'unverified')

    def test_verification_requires_repair(self):
        with self.assertRaises(Conflict):self.engine.verify(self.change())
        self.assertEqual(self.engine.snapshot()['counts']['blocked'],3)

    def test_source_parent_cycle_rejected(self):
        with self.assertRaises(Conflict):
            Lineage({'a':Artifact('a','A','source',parents=['m']), 'm':Artifact('m','M','memory',parents=['a'])})

    def test_derivative_cycle_and_missing_parent_rejected(self):
        with self.assertRaises(Conflict):
            Lineage({'a':Artifact('a','A','memory',parents=['b']), 'b':Artifact('b','B','memory',parents=['a'])})
        with self.assertRaises(Conflict):Lineage({'a':Artifact('a','A','memory',parents=['missing'])})

    def test_identity_registry_mismatch_rejected(self):
        with self.assertRaises(Conflict):Lineage({'a':Artifact('wrong','A','source')})

    def test_proof_chain_and_no_content_in_evidence(self):
        first=self.finish(self.change())
        second_id=self.engine.detect('src-policy','content','alex','second')['id']
        second=self.finish(second_id)
        self.assertEqual(second['previous_hash'],first['hash'])
        self.assertEqual(len(second['hash']),64)
        self.assertNotIn('content',second)
        self.assertFalse(first['live_integration'])

    def test_durable_restart_retains_containment_and_idempotency(self):
        event=self.change()
        with TemporaryDirectory() as folder:
            store=SQLiteStateStore(folder+'/state.db');store.save(self.engine);restored=store.load()
            self.assertEqual(restored.snapshot(),self.engine.snapshot())
            self.assertFalse(restored.retrieve('memory-forecast','jordan')['allowed'])
            self.assertEqual(restored.detect('src-forecast','permission','alex','request-1')['id'],event)

    def test_http_command_validation_rejects_unknown_identity_and_fields(self):
        for payload in [{'action':'probe','artifact_id':'memory-forecast','identity':'admin'},
                        {'action':'reset','arbitrary':'extra'}, {'action':'detect'}]:
            with self.assertRaises(ValueError):validate_command(payload)

class AdapterContractTests(unittest.TestCase):
    def test_bookstack_override_never_claims_effective_authorization(self):
        class Transport:
            def request(self,method,path):
                return {'id':42,'name':'Test','updated_at':'now','html':'test'} if path=='/api/pages/42' else {'own':True,'roles':[]}
        connector=BookStackConnector('https://example.test','id','secret',Transport())
        self.assertEqual(connector.read_object('42')['effective_authorization'],'unknown')
        self.assertEqual(connector.probe_identity('42','alex')['outcome'],'unknown')

    def test_qdrant_uses_tenant_scoped_ids_and_query_filters(self):
        class Transport:
            def request(self,*args):self.args=args;return {'result':{'points':[]}}
        transport=Transport()
        a=QdrantAdapter('https://example.test','docs','tenant-a',transport=transport)
        b=QdrantAdapter('https://example.test','docs','tenant-b',transport=transport)
        self.assertNotEqual(a.point_id('doc'),b.point_id('doc'))
        a.query([.1,.2],['doc'])
        filters=transport.args[2]['filter']['must']
        self.assertEqual(filters[0]['match']['value'],'tenant-a')
        self.assertEqual(filters[1]['match']['any'],['doc'])

if __name__=='__main__':unittest.main()
