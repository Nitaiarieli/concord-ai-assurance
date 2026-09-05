import json
import queue
import tempfile
import threading
import unittest
from http.server import HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from concord.api.server import make_handler
from concord.adapters.sqlite_store import SQLiteStateStore
from concord import demo

class HttpAcceptanceTests(unittest.TestCase):
    def test_authenticated_workflow_and_invalid_requests(self):
        ready=queue.Queue()
        token='test-only-token-with-more-than-24-characters'
        with tempfile.TemporaryDirectory() as folder:
            def serve():
                demo.engine=demo.build_demo()
                store=SQLiteStateStore(folder+'/api.db')
                server=HTTPServer(('127.0.0.1',0),make_handler(token,store))
                ready.put(server)
                server.serve_forever(poll_interval=.02)
                server.server_close()
                store.db.close()
            thread=threading.Thread(target=serve,daemon=True);thread.start()
            server=ready.get(timeout=5)
            base=f'http://127.0.0.1:{server.server_port}'
            def request(path,payload=None,auth=True):
                headers={'Content-Type':'application/json'}
                if auth:headers['Authorization']='Bearer '+token
                req=Request(base+path,data=json.dumps(payload).encode() if payload is not None else None,headers=headers)
                try:
                    with urlopen(req,timeout=3) as r:return r.status,json.load(r)
                except HTTPError as r:return r.code,json.load(r)
            try:
                self.assertEqual(request('/healthz',auth=False)[0],200)
                self.assertEqual(request('/v1/sandbox/snapshot',auth=False)[0],401)
                self.assertEqual(request('/v1/sandbox/commands',{'action':'reset','bad':1})[0],422)
                status,data=request('/v1/sandbox/commands',{'action':'detect','source_id':'src-forecast','kind':'permission','identity':'alex','key':'api-1'})
                self.assertEqual(status,200)
                event=data['result']['id']
                self.assertEqual(request('/v1/sandbox/commands',{'action':'repair','event_id':event})[0],200)
                result=request('/v1/sandbox/commands',{'action':'verify','event_id':event})[1]['result']
                self.assertEqual(result['result'],'verified')
                probe=request('/v1/sandbox/commands',{'action':'probe','artifact_id':'memory-forecast','identity':'alex'})[1]['result']
                self.assertFalse(probe['allowed'])
                self.assertEqual(request('/v1/connectors/bookstack/pages/42')[0],409)
            finally:
                server.shutdown();thread.join(timeout=5)

if __name__=='__main__':unittest.main()
