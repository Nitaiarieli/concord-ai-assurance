"""Same Python engine runs in CPython and the browser's isolated worker."""
from dataclasses import asdict
from hashlib import sha256
from json import dumps
from time import time
from ..domain.models import Artifact, Change, Conflict
from ..domain.graph import Lineage
from .ports import Destination

class AssuranceEngine:
    def __init__(self, artifacts: dict[str, Artifact], destination: Destination, initialize: bool = True):
        self.artifacts = artifacts
        self.graph = Lineage(artifacts)
        self.destination = destination
        self.events: dict[str, Change] = {}
        self.proofs: list[dict] = []
        self.epoch = 0
        self.idempotency: dict[str, tuple[str, str]] = {}
        for node in artifacts.values():
            if initialize and node.kind != "source":
                self._write(node.id)

    def _expected(self, key: str) -> dict | None:
        sources = [self.artifacts[x] for x in sorted(self.graph.sources(key))]
        if any(source.deleted for source in sources):
            return None
        acl = set(sources[0].acl or [])
        for source in sources[1:]:
            acl.intersection_update(source.acl or [])
        content = "\n".join(source.content for source in sources)
        return {"source_revisions": self.graph.revisions(key), "acl": sorted(acl),
                "content": content, "content_hash": sha256(content.encode()).hexdigest()}

    def _write(self, key: str):
        record = self._expected(key)
        if record is None:
            self.destination.delete(key)
        else:
            self.destination.write(key, record)
        self.artifacts[key].source_revisions = self.graph.revisions(key)

    def detect(self, source_id: str, kind: str, identity: str, key: str) -> dict:
        fingerprint = dumps([source_id, kind, identity])
        if key in self.idempotency:
            old_fingerprint, event_id = self.idempotency[key]
            if fingerprint != old_fingerprint:
                raise Conflict("Idempotency key reused with different input")
            return asdict(self.events[event_id])
        if source_id not in self.artifacts or self.artifacts[source_id].kind != "source":
            raise ValueError("Unknown source")
        if kind not in {"permission", "content", "deletion", "probe_failure"}:
            raise ValueError("Unsupported change kind")
        if identity not in {"alex", "jordan"}:
            raise ValueError("Unknown sandbox identity")
        source = self.artifacts[source_id]
        if source.deleted:
            raise Conflict("Reset the sandbox to change a deleted source")
        source.revision += 1
        if kind in {"permission", "probe_failure"}:
            source.acl = [x for x in (source.acl or []) if x != identity]
        elif kind == "content":
            source.content = f"{source.title}: approved revision {source.revision}."
        else:
            source.deleted = True
        self.epoch += 1
        affected = self.graph.descendants(source_id)
        for child in affected:
            self.artifacts[child].status = "blocked"
            self.artifacts[child].containment_epoch = self.epoch
        event = Change(f"chg-{len(self.events)+1:04d}", source_id, kind, identity,
                       source.revision, self.epoch, affected)
        self.events[event.id] = event
        self.idempotency[key] = (fingerprint, event.id)
        return asdict(event)

    def _event(self, event_id: str) -> Change:
        if event_id not in self.events:
            raise ValueError("Unknown change")
        return self.events[event_id]

    def _assert_current(self, event: Change):
        if self.artifacts[event.source_id].revision != event.source_revision:
            raise Conflict("Source changed again; process the newer change")
        if any(self.artifacts[child].containment_epoch != event.epoch for child in event.affected):
            raise Conflict("A newer overlapping change owns containment; process it first")

    def repair(self, event_id: str) -> dict:
        event = self._event(event_id)
        self._assert_current(event)
        if event.stage == "verified":
            return asdict(event)
        for child in event.affected:
            self.artifacts[child].status = "blocked"
        try:
            for child in event.affected:
                self._write(child)
        except Exception:
            event.stage = "failed"
            event.failure = "Destination repair failed; affected retrieval stays blocked."
            raise
        event.stage = "repaired"
        event.failure = None
        return asdict(event)

    def retrieve(self, artifact_id: str, identity: str) -> dict:
        if artifact_id not in self.artifacts or self.artifacts[artifact_id].kind == "source":
            raise ValueError("Choose a registered derivative")
        node = self.artifacts[artifact_id]
        if node.status != "current":
            return {"allowed": False, "reason": "Contained until verification", "artifact_id": artifact_id}
        if not self.graph.allowed(artifact_id, identity):
            return {"allowed": False, "reason": "Source policy denies access", "artifact_id": artifact_id}
        record = self.destination.retrieve(artifact_id, identity)
        if record is None or record.get("source_revisions") != self.graph.revisions(artifact_id):
            return {"allowed": False, "reason": "Destination missing or stale", "artifact_id": artifact_id}
        if record != self._expected(artifact_id):
            return {"allowed": False, "reason": "Destination integrity mismatch", "artifact_id": artifact_id}
        return {"allowed": True, "reason": "Current source policy and destination agree",
                "artifact_id": artifact_id, "content": record["content"], "source_revisions": record["source_revisions"]}

    def verify(self, event_id: str) -> dict:
        event = self._event(event_id)
        self._assert_current(event)
        try:
            return self._verify(event_id)
        except Exception:
            for child in event.affected:
                self.artifacts[child].status = "blocked"
            event.stage = "unverified"
            event.failure = "Verification interrupted; retrieval remains blocked."
            raise

    def _verify(self, event_id: str) -> dict:
        event = self._event(event_id)
        self._assert_current(event)
        if event.stage == "verified":
            return next(p for p in self.proofs if p["id"] == event.proof_id)
        if event.stage != "repaired":
            raise Conflict("Repair must complete before verification")
        checks = []
        for source in sorted(set().union(*(self.graph.sources(child) for child in event.affected))):
            authority = self.artifacts[source]
            checks.append({"artifact_id": source, "check": "source_authority_known",
                           "passed": authority.acl is not None, "observed": "known" if authority.acl is not None else "unknown"})
        for child in event.affected:
            expected = self._expected(child)
            actual = self.destination.read(child)
            checks.append({"artifact_id": child, "check": "destination_readback", "passed": actual == expected})
            for identity in ["alex", "jordan"]:
                should_allow = self.graph.allowed(child, identity)
                result = self.destination.retrieve(child, identity)
                passed = bool(result) == should_allow and (not result or result == expected)
                checks.append({"artifact_id": child, "check": "destination_identity_probe", "identity": identity,
                               "expected": "allow" if should_allow else "deny", "observed": "allow" if result else "deny", "passed": passed})
        if event.kind == "probe_failure":
            checks.append({"check": "probe_reachability", "passed": False, "observed": "unknown"})
        passed = all(check["passed"] for check in checks)
        if passed:
            for child in event.affected:
                self.artifacts[child].status = "current"
            for child in event.affected:
                for identity in ["alex", "jordan"]:
                    result = self.retrieve(child, identity)
                    checks.append({"artifact_id": child, "check": "protected_retrieval_probe", "identity": identity,
                                   "expected": "allow" if self.graph.allowed(child, identity) else "deny",
                                   "observed": "allow" if result["allowed"] else "deny", "passed": result["allowed"] == self.graph.allowed(child, identity)})
        controls = [n for n in self.artifacts.values() if n.kind == "memory" and n.id not in event.affected
                    and n.status == "current" and self.graph.allowed(n.id, "jordan")]
        if controls:
            result = self.retrieve(controls[0].id, "jordan")
            checks.append({"artifact_id": controls[0].id, "check": "unaffected_positive_control", "identity": "jordan",
                           "expected": "allow", "observed": "allow" if result["allowed"] else "deny", "passed": result["allowed"]})
        passed = all(check["passed"] for check in checks)
        if not passed:
            for child in event.affected:
                self.artifacts[child].status = "blocked"
        event.stage = "verified" if passed else "unverified"
        event.failure = None if passed else "Verification incomplete; affected retrieval remains blocked."
        proof = {"id": f"proof-{len(self.proofs)+1:04d}", "event_id": event.id,
                 "scope": "sandbox_registered_local_index", "live_integration": False,
                 "created_at": time(), "source_id": event.source_id, "source_revision": event.source_revision,
                 "epoch": self.epoch, "affected": event.affected, "identity": event.identity,
                 "result": event.stage, "checks": checks, "previous_hash": self.proofs[-1]["hash"] if self.proofs else None}
        proof["hash"] = sha256(dumps(proof, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        event.proof_id = proof["id"]
        self.proofs.append(proof)
        return proof

    def snapshot(self) -> dict:
        nodes = [node.public() for node in self.artifacts.values()]
        return {"mode": "sandbox", "engine": "python", "epoch": self.epoch, "nodes": nodes,
                "events": [asdict(e) for e in reversed(list(self.events.values()))], "proofs": list(reversed(self.proofs)),
                "counts": {"sources": sum(n["kind"] == "source" for n in nodes), "derivatives": sum(n["kind"] != "source" for n in nodes),
                           "blocked": sum(n["status"] == "blocked" for n in nodes), "verified": sum(e.stage == "verified" for e in self.events.values())}}
