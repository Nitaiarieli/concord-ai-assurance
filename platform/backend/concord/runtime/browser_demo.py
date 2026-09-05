"""Separate sample-source editor for the browser; production core is unchanged.

Source writes never call tick. The browser worker's independent timer observes
the mutable source, as the installable daemon observes filesystem/API sources.
The SQLite file lives in the worker's virtual filesystem, not customer storage.
"""
from dataclasses import asdict
import json
import os
import time
from .models import SourceDocument, Snapshot
from .core import SyncRuntime

class SampleSource:
    def __init__(self):
        self.available = True
        self.serial = 0
        self.documents = {}
        self.restore()

    def restore(self):
        self.serial += 1
        self.available = True
        self.documents = {d.id: d for d in [
            SourceDocument("api-limits", "API usage limits", "The Atlas API allows 100 requests per minute. The standard plan includes email support. This is sample product knowledge.", f"v{self.serial}", ["alex", "jordan"]),
            SourceDocument("team-guide", "Customer support guide", "For API incidents, contact the support team. The team reviews customer requests every Tuesday. This is an unrelated sample document.", f"v{self.serial}", ["alex", "jordan"]),
        ]}

    def scan(self):
        if not self.available:
            return Snapshot([], complete=False, error="Sample source unavailable")
        return Snapshot(list(self.documents.values()), cursor=str(self.serial))

_source = SampleSource()
_database = os.environ.get("CONCORD_BROWSER_SAMPLE_DATABASE", "/concord-autosync.sqlite3")
_runtime = None

def dispatch(raw: str) -> str:
    global _runtime
    if _runtime is None:
        _runtime = SyncRuntime(database=_database, source=_source, tenant_id="browser-sample", connection_id="sample-knowledge")
    request = json.loads(raw)
    action = request.get("action", "status")
    result = None
    if action == "tick":
        _runtime.tick()
    elif action == "save_source":
        data = request["document"]
        if data.get("id") not in _source.documents:
            raise ValueError("Choose an existing sample source document")
        if not isinstance(data.get("title"), str) or not data["title"].strip() or len(data["title"]) > 160:
            raise ValueError("A sample title of up to 160 characters is required")
        if not isinstance(data.get("content"), str) or len(data["content"]) > 12000:
            raise ValueError("Sample content exceeds its size limit")
        acl = data.get("acl")
        if acl is not None and (not isinstance(acl, list) or any(x not in {"alex", "jordan"} for x in acl)):
            raise ValueError("Use explicitly named sample identities")
        if data.get("schema_version") not in (1, 2):
            raise ValueError("Unsupported sample schema selection")
        _source.serial += 1
        _source.documents[data["id"]] = SourceDocument(data["id"], data["title"], data["content"], f"v{_source.serial}", acl, data["schema_version"])
    elif action == "delete_source":
        _source.documents.pop(request["id"], None)
        _source.serial += 1
    elif action == "availability":
        _source.available = request.get("available") is True
    elif action == "restore_source":
        _source.restore()
    elif action == "retrieve":
        # Identity selection is explicitly a browser sample control. The actual
        # local HTTP server uses server-bound consumer tokens instead.
        result = _runtime.retrieve(request.get("query", ""), request.get("identity", ""), request.get("route", "support"))
    elif action != "status":
        raise ValueError("Unknown browser sample action")
    return json.dumps({"status": _runtime.status(), "documents": [asdict(d) for d in _source.documents.values()], "available": _source.available, "result": result})
