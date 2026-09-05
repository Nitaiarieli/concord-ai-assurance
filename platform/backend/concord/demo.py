"""Explicitly synthetic fixture composition, not a live connector."""
import json
from .domain.models import Artifact
from .adapters.local_index import LocalIndex
from .application.engine import AssuranceEngine

def build_demo() -> AssuranceEngine:
    nodes = {}
    for slug, title, content in [
        ("forecast", "Q4 revenue forecast", "The approved Q4 forecast is $2.4 million."),
        ("policy", "Customer data policy", "Customer records are retained for 90 days."),
        ("onboarding", "Engineering handbook", "New engineers complete a peer-reviewed onboarding checklist."),
    ]:
        source = f"src-{slug}"
        nodes[source] = Artifact(source, title, "source", acl=["alex", "jordan"], content=content)
        parent = source
        for kind, suffix in [("chunk", "Document chunk"), ("index", "Retrieval record"), ("memory", "Agent memory")]:
            key = f"{kind}-{slug}"
            nodes[key] = Artifact(key, f"{title} · {suffix}", kind, parents=[parent])
            parent = key
    return AssuranceEngine(nodes, LocalIndex())

engine = build_demo()

def dispatch(payload_json: str) -> str:
    global engine
    payload = json.loads(payload_json)
    action = payload.get("action", "snapshot")
    if action == "reset":
        engine = build_demo()
        result = None
    elif action == "detect":
        result = engine.detect(payload["source_id"], payload["kind"], payload["identity"], payload["key"])
    elif action == "repair":
        result = engine.repair(payload["event_id"])
    elif action == "verify":
        result = engine.verify(payload["event_id"])
    elif action == "probe":
        result = engine.retrieve(payload["artifact_id"], payload["identity"])
    elif action == "snapshot":
        result = None
    else:
        raise ValueError("Unknown command")
    return json.dumps({"snapshot": engine.snapshot(), "result": result})
