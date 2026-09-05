"""Dependency-free local sandbox API. Put production authentication/TLS at an audited gateway.

Runs single-threaded so command validation, state mutation and persistence cannot interleave.
The hosted UI uses the same engine inside WebAssembly; this server runs independently.
"""
import argparse
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit
from .. import demo
from ..domain.models import Conflict
from ..adapters.sqlite_store import SQLiteStateStore
from ..adapters.bookstack import BookStackConnector
from ..adapters.http_client import AdapterError

ACTIONS = {'snapshot':set(), 'reset':set(), 'detect':{'source_id','kind','identity','key'},
           'repair':{'event_id'}, 'verify':{'event_id'}, 'probe':{'artifact_id','identity'}}

def validate_command(data):
    if not isinstance(data,dict) or data.get('action') not in ACTIONS:
        raise ValueError('A supported action is required')
    keys = ACTIONS[data['action']]
    if set(data) != keys | {'action'}:
        raise ValueError('Unexpected or missing command fields')
    if any(not isinstance(data[k],str) or not 1 <= len(data[k]) <= 200 for k in keys):
        raise ValueError('Command fields must be nonempty bounded strings')
    if data['action']=='probe' and data['identity'] not in {'alex','jordan'}:
        raise ValueError('Unknown sandbox identity')
    return data

def make_handler(token: str, store: SQLiteStateStore, allowed_origin: str = ''):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            # No raw URL, headers, tokens, or request content in access logs.
            pass

        def respond(self, status, payload):
            body=json.dumps(payload).encode()
            self.send_response(status)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(body)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            if allowed_origin and self.headers.get('Origin')==allowed_origin:
                self.send_header('Access-Control-Allow-Origin',allowed_origin)
                self.send_header('Vary','Origin')
            self.end_headers();self.wfile.write(body)

        def authenticated(self):
            incoming=self.headers.get('Authorization','')
            return hmac.compare_digest(incoming.encode(),('Bearer '+token).encode())

        def do_OPTIONS(self):
            if not allowed_origin or self.headers.get('Origin')!=allowed_origin:
                return self.respond(403,{'error':'Origin not allowed'})
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin',allowed_origin)
            self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers','Authorization, Content-Type')
            self.send_header('Vary','Origin');self.end_headers()

        def do_GET(self):
            path=urlsplit(self.path).path
            if path=='/healthz':
                return self.respond(200,{'status':'ready','mode':'sandbox','engine':'python','api_version':'1'})
            if not self.authenticated():
                return self.respond(401,{'error':'Authentication required'})
            if path=='/v1/sandbox/snapshot':
                return self.respond(200, demo.engine.snapshot())
            if path=='/v1/connectors':
                return self.respond(200,{'bookstack':'configured-unverified' if os.environ.get('BOOKSTACK_URL') else 'not-configured',
                    'local_index':'sandbox-ready','qdrant':'adapter-only','live_verified':False})
            if path.startswith('/v1/connectors/bookstack/pages/'):
                page_id=path.removeprefix('/v1/connectors/bookstack/pages/')
                if not all(os.environ.get(k) for k in ['BOOKSTACK_URL','BOOKSTACK_TOKEN_ID','BOOKSTACK_TOKEN_SECRET']):
                    return self.respond(409,{'error':'BookStack environment configuration required'})
                try:
                    connector=BookStackConnector(os.environ['BOOKSTACK_URL'],os.environ['BOOKSTACK_TOKEN_ID'],os.environ['BOOKSTACK_TOKEN_SECRET'])
                    return self.respond(200,connector.read_object(page_id))
                except ValueError as e:
                    return self.respond(422,{'error':str(e)})
                except (AdapterError, KeyError):
                    return self.respond(502,{'error':'Source read failed; effective authorization remains unknown'})
            return self.respond(404,{'error':'Unknown route'})

        def do_POST(self):
            if not self.authenticated():
                return self.respond(401,{'error':'Authentication required'})
            if urlsplit(self.path).path!='/v1/sandbox/commands':
                return self.respond(404,{'error':'Unknown route'})
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0 < length <= 16384:
                    return self.respond(413,{'error':'Request must be 1–16384 bytes'})
                if self.headers.get('Content-Type','').split(';')[0]!='application/json':
                    return self.respond(415,{'error':'application/json required'})
                data=validate_command(json.loads(self.rfile.read(length)))
                result=json.loads(demo.dispatch(json.dumps(data)))
                store.save(demo.engine)
                return self.respond(200,result)
            except Conflict as e:
                store.save(demo.engine)
                return self.respond(409,{'error':str(e)})
            except (ValueError, KeyError, UnicodeError):
                return self.respond(422,{'error':'Invalid command'})
            except Exception:
                # Preserve containment following a partial failure; do not report a successful repair.
                store.save(demo.engine)
                return self.respond(500,{'error':'Command failed; verify state before retrying'})
    return Handler

def main():
    parser=argparse.ArgumentParser(description='Concord local Python sandbox API')
    parser.add_argument('--port',type=int,default=8080)
    parser.add_argument('--database',default='concord-demo.sqlite3')
    args=parser.parse_args()
    token=os.environ.get('CONCORD_API_TOKEN','')
    if len(token)<24:
        parser.error('Set CONCORD_API_TOKEN to a random token of at least 24 characters')
    store=SQLiteStateStore(args.database)
    demo.engine=store.load() or demo.build_demo()
    server=HTTPServer(('127.0.0.1',args.port),make_handler(token,store,os.environ.get('CONCORD_ALLOWED_ORIGIN','')))
    server.timeout=15
    print(f'Concord sandbox API listening on loopback port {args.port}. Live integration: unverified.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__=='__main__':
    main()
