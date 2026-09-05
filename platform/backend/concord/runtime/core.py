"""A durable, conservative synchronization loop for registered local routes.

This is a real local prototype: it polls a source, journals jobs, updates a local
SQLite chunk index, invalidates a separate response cache, and probes both local
retrieval routes before publication. It is not a vector database or a proof of
customer-agent integration. Provider revision strings are never ordered.

All public methods share one lock and one connection. A write/verification
transaction is invisible to other connections until its verification passes.
One runtime worker per database is required; overlapping workers are rejected
by a durable lease. Incomplete scans make reads unavailable, not falsely fresh.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
from threading import RLock
import time
from typing import Any, Callable
import uuid

from .models import Snapshot, SourceDocument


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class _WorkerLeaseLost(RuntimeError):
    pass


class SyncRuntime:
    """A single polling worker. The caller schedules tick(); no thread is started.

    max_staleness_seconds is a read freshness budget, not a synchronization SLA.
    Source adapters must have their own request/pagination timeout and bounds.
    """

    LIMITS = {
        "max_documents": 1000,
        "max_document_bytes": 1024 * 1024,
        "max_snapshot_bytes": 16 * 1024 * 1024,
        "max_metadata_bytes": 64 * 1024,
        "max_acl_identities": 1000,
        "chunk_characters": 1000,
        "max_query_characters": 512,
        "max_results": 50,
    }
    ROUTES = ("support", "success")

    def __init__(self, database: str, source: Any, tenant_id: str = "local",
                 connection_id: str = "source", now: Callable[[], float] | None = None,
                 max_staleness_seconds: float = 60.0):
        if not tenant_id or not connection_id:
            raise ValueError("Tenant and connection identifiers are required")
        if not math.isfinite(float(max_staleness_seconds)) or max_staleness_seconds <= 0:
            raise ValueError("Freshness budget must be positive")
        if database == ":memory:":
            raise ValueError("Use a file-backed SQLite path for restart durability")
        self.source = source
        self.tenant_id = tenant_id
        self.connection_id = connection_id
        self._namespace = _hash(_json([tenant_id, connection_id]))
        self._now = now or time.time
        self.max_staleness_seconds = float(max_staleness_seconds)
        self._lock = RLock()
        self._closed = False
        self._owner = uuid.uuid4().hex
        Path(database).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(database, check_same_thread=False, isolation_level=None, timeout=5)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA foreign_keys=ON")
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA busy_timeout=5000")
        self._initialize()

    def _initialize(self) -> None:
        self._db.executescript("""
            CREATE TABLE IF NOT EXISTS sync_sources (
                namespace TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, connection_id TEXT NOT NULL,
                generation INTEGER NOT NULL DEFAULT 0, last_observed_at REAL,
                last_complete_at REAL, complete INTEGER NOT NULL DEFAULT 0,
                cursor TEXT, error TEXT, observed_changes INTEGER NOT NULL DEFAULT 0,
                lease_owner TEXT, lease_expires_at REAL
            );
            CREATE TABLE IF NOT EXISTS sync_documents (
                namespace TEXT NOT NULL, document_id TEXT NOT NULL,
                title TEXT NOT NULL, revision TEXT NOT NULL, content_hash TEXT NOT NULL,
                fingerprint TEXT NOT NULL, acl_json TEXT, schema_version INTEGER NOT NULL,
                metadata_json TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0,
                blocked_reason TEXT, updated_at REAL NOT NULL, verified_at REAL,
                PRIMARY KEY(namespace, document_id)
            );
            CREATE TABLE IF NOT EXISTS sync_chunks (
                namespace TEXT NOT NULL, document_id TEXT NOT NULL, position INTEGER NOT NULL,
                chunk_id TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL,
                PRIMARY KEY(namespace, document_id, position),
                FOREIGN KEY(namespace, document_id) REFERENCES sync_documents(namespace, document_id)
                    ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sync_jobs (
                id TEXT PRIMARY KEY, namespace TEXT NOT NULL, document_id TEXT NOT NULL,
                operation TEXT NOT NULL, fingerprint TEXT NOT NULL, expected_revision TEXT,
                state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL, updated_at REAL NOT NULL, error TEXT
            );
            CREATE INDEX IF NOT EXISTS sync_jobs_namespace ON sync_jobs(namespace, updated_at);
            CREATE TABLE IF NOT EXISTS sync_response_cache (
                namespace TEXT NOT NULL, document_id TEXT NOT NULL, identity TEXT NOT NULL,
                fingerprint TEXT NOT NULL, payload_json TEXT NOT NULL,
                PRIMARY KEY(namespace, document_id, identity),
                FOREIGN KEY(namespace, document_id) REFERENCES sync_documents(namespace, document_id)
                    ON DELETE CASCADE
            );
        """)
        self._db.execute(
            "INSERT OR IGNORE INTO sync_sources(namespace,tenant_id,connection_id) VALUES(?,?,?)",
            (self._namespace, self.tenant_id, self.connection_id),
        )

    def _check_open(self) -> None:
        if self._closed:
            raise RuntimeError("Runtime is closed")

    def _timestamp(self) -> float:
        value = self._now()
        return float(value.timestamp() if hasattr(value, "timestamp") else value)

    def _source_row(self) -> sqlite3.Row:
        return self._db.execute("SELECT * FROM sync_sources WHERE namespace=?", (self._namespace,)).fetchone()

    def _set_source(self, **fields: Any) -> None:
        allowed = {"generation", "last_observed_at", "last_complete_at", "complete", "cursor",
                   "error", "observed_changes", "lease_owner", "lease_expires_at"}
        if not fields.keys() <= allowed:
            raise ValueError("Invalid source state field")
        assignments = ",".join(f"{key}=?" for key in fields)
        self._db.execute(f"UPDATE sync_sources SET {assignments} WHERE namespace=?",
                         (*fields.values(), self._namespace))

    def _claim_worker(self) -> None:
        self._db.execute("BEGIN IMMEDIATE")
        try:
            row = self._source_row()
            if (row["lease_owner"] not in (None, self._owner)
                    and (row["lease_expires_at"] or 0) > self._timestamp()):
                raise RuntimeError("Another runtime worker is active for this source")
            # Adapters are required to finish a bounded scan within this lease.
            self._set_source(lease_owner=self._owner, lease_expires_at=self._timestamp() + 300)
            self._db.execute("COMMIT")
        except Exception:
            self._db.execute("ROLLBACK")
            raise

    def _release_worker(self) -> None:
        self._db.execute(
            "UPDATE sync_sources SET lease_owner=NULL,lease_expires_at=NULL WHERE namespace=? AND lease_owner=?",
            (self._namespace, self._owner),
        )

    def _ensure_worker(self) -> None:
        row = self._source_row()
        if (row["lease_owner"] != self._owner
                or (row["lease_expires_at"] or 0) <= self._timestamp()
                or row["generation"] != self._worker_generation):
            raise _WorkerLeaseLost("Worker lease expired or was replaced; stale work discarded")

    def _validate(self, snapshot: Snapshot) -> dict[str, tuple[SourceDocument, str]]:
        if not isinstance(snapshot, Snapshot):
            raise ValueError("Adapter must return Snapshot")
        if snapshot.error or snapshot.complete is not True:
            raise ValueError("Source scan incomplete; prior index retained")
        if not isinstance(snapshot.documents, list) or len(snapshot.documents) > self.LIMITS["max_documents"]:
            raise ValueError("Source document count exceeds supported snapshot scope")
        if snapshot.cursor is not None and (not isinstance(snapshot.cursor, str) or len(snapshot.cursor) > 4096):
            raise ValueError("Invalid source cursor")
        result: dict[str, tuple[SourceDocument, str]] = {}
        total_bytes = 0
        for document in snapshot.documents:
            if not isinstance(document, SourceDocument):
                raise ValueError("Invalid source document")
            if not isinstance(document.id, str) or not 0 < len(document.id) <= 256:
                raise ValueError("Invalid stable document identifier")
            if document.id in result:
                raise ValueError("Duplicate document identifiers make the snapshot ambiguous")
            if not isinstance(document.title, str) or len(document.title) > 1024:
                raise ValueError("Invalid document title")
            if not isinstance(document.revision, str) or not 0 < len(document.revision) <= 512:
                raise ValueError("An opaque, non-empty source revision is required")
            if type(document.schema_version) is not int or document.schema_version != 1:
                raise ValueError("Unsupported schema version; source requires mapping review")
            if not isinstance(document.content, str):
                raise ValueError("Document content must be text")
            content_bytes = len(document.content.encode("utf-8"))
            if content_bytes > self.LIMITS["max_document_bytes"]:
                raise ValueError("Document exceeds supported text size")
            total_bytes += content_bytes
            if total_bytes > self.LIMITS["max_snapshot_bytes"]:
                raise ValueError("Source exceeds supported total text size")
            if document.acl is not None:
                if (not isinstance(document.acl, list)
                        or len(document.acl) > self.LIMITS["max_acl_identities"]
                        or any(not isinstance(identity, str) or not 0 < len(identity) <= 256
                               for identity in document.acl)):
                    raise ValueError("Invalid ACL; access cannot be inferred")
            if not isinstance(document.metadata, dict):
                raise ValueError("Document metadata must be an object")
            metadata = _json(document.metadata)
            if len(metadata.encode("utf-8")) > self.LIMITS["max_metadata_bytes"]:
                raise ValueError("Document metadata exceeds supported size")
            fingerprint = _hash(_json({
                "id": document.id, "title": document.title, "revision": document.revision,
                "content_hash": _hash(document.content), "acl": None if document.acl is None else sorted(set(document.acl)),
                "schema_version": document.schema_version, "metadata": document.metadata,
            }))
            result[document.id] = (document, fingerprint)
        return result

    def _scan(self) -> tuple[Snapshot, dict[str, tuple[SourceDocument, str]]]:
        try:
            snapshot = self.source.scan()
        except Exception:
            # Do not surface arbitrary connector exception text (possibly secrets).
            raise RuntimeError("Source scan failed; freshness unknown") from None
        return snapshot, self._validate(snapshot)

    def tick(self) -> dict[str, Any]:
        """Poll an authoritative snapshot and reconcile without per-change input.

        Changed snapshots are re-read before commit. A mismatch keeps the prior
        index blocked, and the next tick observes/retries the latest snapshot.
        """
        with self._lock:
            self._check_open()
            self._claim_worker()
            try:
                try:
                    return self._tick()
                except _WorkerLeaseLost:
                    # Never overwrite state published by a worker that replaced us.
                    return self.status()
            finally:
                self._release_worker()

    def _tick(self) -> dict[str, Any]:
        state = self._source_row()
        self._worker_generation = state["generation"] + 1
        self._set_source(generation=state["generation"] + 1, last_observed_at=self._timestamp(),
                         complete=0, error=None)
        try:
            snapshot, observed = self._scan()
        except Exception as error:
            # Connector exception strings may contain URLs, tokens or content;
            # only bounded runtime validation messages are exposed to callers.
            message = str(error) if isinstance(error, ValueError) else "Source scan failed; freshness unknown"
            self._db.execute("BEGIN IMMEDIATE")
            try:
                self._ensure_worker()
                self._set_source(error=message[:240], complete=0)
                self._db.execute("COMMIT")
            except Exception:
                self._db.execute("ROLLBACK")
                raise
            return self.status()

        rows = {row["document_id"]: row for row in self._db.execute(
            "SELECT * FROM sync_documents WHERE namespace=?", (self._namespace,))}
        changed = [key for key, (document, fingerprint) in observed.items()
                   if key not in rows or not self._destination_matches(rows[key], document, fingerprint)]
        deleted = [key for key in rows if key not in observed]
        job_ids: list[str] = []
        now = self._timestamp()
        # Persist planned work and a read barrier BEFORE touching derivatives.
        self._db.execute("BEGIN IMMEDIATE")
        try:
            self._ensure_worker()
            for key in changed + deleted:
                operation = "delete" if key in deleted else self._operation(rows.get(key), observed[key][0])
                fingerprint = "deleted" if key in deleted else observed[key][1]
                revision = None if key in deleted else observed[key][0].revision
                job_id = _hash(_json([self._namespace, key, operation, fingerprint]))
                self._db.execute("UPDATE sync_jobs SET state='superseded',updated_at=? WHERE namespace=? AND document_id=? AND id<>? AND state IN ('planned','failed')",
                                 (now, self._namespace, key, job_id))
                self._db.execute("""
                    INSERT INTO sync_jobs(id,namespace,document_id,operation,fingerprint,expected_revision,
                        state,attempts,created_at,updated_at,error) VALUES(?,?,?,?,?,?,'planned',1,?,?,NULL)
                    ON CONFLICT(id) DO UPDATE SET state='planned',attempts=attempts+1,updated_at=excluded.updated_at,error=NULL
                """, (job_id, self._namespace, key, operation, fingerprint, revision, now, now))
                self._db.execute("UPDATE sync_documents SET verified=0,blocked_reason='update_pending' WHERE namespace=? AND document_id=?",
                                 (self._namespace, key))
                job_ids.append(job_id)
            self._db.execute("COMMIT")
        except Exception:
            self._db.execute("ROLLBACK")
            raise

        try:
            self._db.execute("BEGIN IMMEDIATE")
            self._ensure_worker()
            for key in changed:
                self._apply_document(*observed[key])
            for key in deleted:
                self._db.execute("DELETE FROM sync_documents WHERE namespace=? AND document_id=?", (self._namespace, key))
            # Provisional metadata is inside an uncommitted transaction, allowing
            # the real retrieval implementation to be exercised before publish.
            self._set_source(complete=1, last_complete_at=self._timestamp(), error=None)
            for key in observed:
                self._verify_document(*observed[key])
                self._db.execute("UPDATE sync_documents SET verified_at=? WHERE namespace=? AND document_id=?",
                                 (self._timestamp(), self._namespace, key))
            for key in deleted:
                self._verify_deleted(key, json.loads(rows[key]["acl_json"]) if rows[key]["acl_json"] else [])
            confirmed_snapshot, confirmed = self._scan()
            if {key: value[1] for key, value in confirmed.items()} != {key: value[1] for key, value in observed.items()}:
                raise RuntimeError("Source changed during verification; waiting for next observation")
            snapshot = confirmed_snapshot
            self._ensure_worker()
            for job_id in job_ids:
                self._db.execute("UPDATE sync_jobs SET state='verified',updated_at=?,error=NULL WHERE id=?",
                                 (self._timestamp(), job_id))
            for key, (document, _) in observed.items():
                if document.acl is None:
                    self._db.execute("UPDATE sync_jobs SET state='blocked',error='ACL is unknown; retrieval remains denied' WHERE namespace=? AND document_id=? AND state='verified'",
                                     (self._namespace, key))
            self._set_source(complete=1, last_complete_at=self._timestamp(), cursor=snapshot.cursor,
                             observed_changes=state["observed_changes"] + len(changed) + len(deleted), error=None)
            self._db.execute("COMMIT")
        except Exception as error:
            if self._db.in_transaction:
                self._db.execute("ROLLBACK")
            if isinstance(error, _WorkerLeaseLost):
                raise
            message = "Verification failed; affected data remains blocked"
            if isinstance(error, RuntimeError) and str(error).startswith("Source changed during verification"):
                message = "Source changed during verification; waiting for next observation"
            elif isinstance(error, ValueError):
                message = "Source confirmation incomplete or invalid; freshness unknown"
            self._db.execute("BEGIN IMMEDIATE")
            try:
                self._ensure_worker()
                self._set_source(complete=0, error=message)
                for job_id in job_ids:
                    self._db.execute("UPDATE sync_jobs SET state='failed',updated_at=?,error=? WHERE id=?",
                                     (self._timestamp(), message, job_id))
                self._db.execute("COMMIT")
            except Exception:
                self._db.execute("ROLLBACK")
                raise
        return self.status()

    def _destination_matches(self, row: sqlite3.Row, document: SourceDocument, fingerprint: str) -> bool:
        """Reconciliation detects index drift even if no new source revision exists."""
        expected_acl = None if document.acl is None else _json(sorted(set(document.acl)))
        if (not row["verified"] or row["fingerprint"] != fingerprint or row["revision"] != document.revision
                or row["title"] != document.title or row["acl_json"] != expected_acl
                or row["metadata_json"] != _json(document.metadata) or row["schema_version"] != document.schema_version
                or row["content_hash"] != _hash(document.content)):
            return False
        try:
            content, _ = self._read_content(document.id)
            return content == document.content
        except RuntimeError:
            return False

    @staticmethod
    def _operation(previous: sqlite3.Row | None, document: SourceDocument) -> str:
        if previous is None:
            return "discover"
        if previous["metadata_json"] != _json(document.metadata) or previous["title"] != document.title:
            return "structure_update"
        if previous["acl_json"] != (None if document.acl is None else _json(sorted(set(document.acl)))):
            return "permission_update"
        return "content_update"

    def _apply_document(self, document: SourceDocument, fingerprint: str) -> None:
        now = self._timestamp()
        acl = None if document.acl is None else _json(sorted(set(document.acl)))
        blocked = "acl_unknown" if document.acl is None else None
        self._db.execute("""
            INSERT INTO sync_documents(namespace,document_id,title,revision,content_hash,fingerprint,acl_json,
                schema_version,metadata_json,verified,blocked_reason,updated_at,verified_at)
            VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)
            ON CONFLICT(namespace,document_id) DO UPDATE SET title=excluded.title,revision=excluded.revision,
                content_hash=excluded.content_hash,fingerprint=excluded.fingerprint,acl_json=excluded.acl_json,
                schema_version=excluded.schema_version,metadata_json=excluded.metadata_json,verified=1,
                blocked_reason=excluded.blocked_reason,updated_at=excluded.updated_at,verified_at=excluded.verified_at
        """, (self._namespace, document.id, document.title, document.revision, _hash(document.content),
                fingerprint, acl, document.schema_version, _json(document.metadata), blocked, now, now))
        self._db.execute("DELETE FROM sync_chunks WHERE namespace=? AND document_id=?", (self._namespace, document.id))
        self._db.execute("DELETE FROM sync_response_cache WHERE namespace=? AND document_id=?", (self._namespace, document.id))
        # Preserve exact text on reassembly; no lossy whitespace normalization.
        size = self.LIMITS["chunk_characters"]
        chunks = [document.content[index:index + size] for index in range(0, len(document.content), size)] or [""]
        for index, content in enumerate(chunks):
            chunk_id = _hash(_json([self._namespace, document.id, index, _hash(content)]))
            self._db.execute("INSERT INTO sync_chunks VALUES(?,?,?,?,?,?)",
                             (self._namespace, document.id, index, chunk_id, content, _hash(content)))

    def _read_content(self, document_id: str) -> tuple[str, list[str]]:
        chunks = self._db.execute("SELECT * FROM sync_chunks WHERE namespace=? AND document_id=? ORDER BY position",
                                  (self._namespace, document_id)).fetchall()
        if not chunks:
            raise RuntimeError("Destination has no chunks")
        for chunk in chunks:
            if _hash(chunk["content"]) != chunk["content_hash"]:
                raise RuntimeError("Destination chunk hash mismatch")
        return "".join(chunk["content"] for chunk in chunks), [chunk["chunk_id"] for chunk in chunks]

    def _verify_document(self, document: SourceDocument, fingerprint: str) -> None:
        """Independent readback plus the actual two local consumer implementations.

        Identity probes cover one allowed identity and one explicitly unlisted
        identity. ACL equality is checked in full; this is not full customer IAM.
        """
        row = self._db.execute("SELECT * FROM sync_documents WHERE namespace=? AND document_id=?",
                               (self._namespace, document.id)).fetchone()
        text, _ = self._read_content(document.id)
        expected_acl = None if document.acl is None else _json(sorted(set(document.acl)))
        if (row is None or row["revision"] != document.revision or row["fingerprint"] != fingerprint
                or row["acl_json"] != expected_acl or text != document.content or _hash(text) != row["content_hash"]):
            raise RuntimeError("Destination readback mismatch")
        denied = "concord-denied-probe-" + uuid.uuid4().hex
        while document.acl and denied in document.acl:
            denied = "concord-denied-probe-" + uuid.uuid4().hex
        for route in self.ROUTES:
            denied_result = self.retrieve("", denied, route, document_id=document.id)
            if denied_result["documents"]:
                raise RuntimeError("Unauthorized route disclosed source content")
            if document.acl:
                identity = sorted(set(document.acl))[0]
                first = self.retrieve("", identity, route, document_id=document.id)
                second = self.retrieve("", identity, route, document_id=document.id)
                for result in (first, second):
                    if len(result["documents"]) != 1:
                        raise RuntimeError("Registered route did not retrieve expected source")
                    found = result["documents"][0]
                    if found["revision"] != document.revision or found["content"] != document.content:
                        raise RuntimeError("Registered route retrieved stale content")

    def _verify_deleted(self, document_id: str, prior_identities: list[str]) -> None:
        for table in ("sync_documents", "sync_chunks", "sync_response_cache"):
            remaining = self._db.execute(f"SELECT COUNT(*) FROM {table} WHERE namespace=? AND document_id=?",
                                         (self._namespace, document_id)).fetchone()[0]
            if remaining:
                raise RuntimeError("Deleted source remains in registered destination")
        for route in self.ROUTES:
            identity = prior_identities[0] if prior_identities else "concord-deletion-probe"
            if self.retrieve("", identity, route, document_id=document_id)["documents"]:
                raise RuntimeError("Deleted source remains retrievable")

    def _read_barrier(self) -> str | None:
        source = self._source_row()
        if source["complete"] != 1 or source["last_complete_at"] is None:
            return "Source freshness unknown; waiting for a complete successful observation"
        if self._timestamp() - source["last_complete_at"] > self.max_staleness_seconds:
            return "Source observation exceeded the configured freshness budget"
        return None

    def retrieve(self, query: str, identity: str, route: str = "support", *,
                 document_id: str | None = None) -> dict[str, Any]:
        """Retrieve indexed text after current explicit ACL evaluation.

        identity is trusted caller context supplied by the host application,
        not authentication. The HTTP host must bind it server-side. The optional
        document_id selects an exact registered source for retrieval probes.
        """
        with self._lock:
            self._check_open()
            if route not in self.ROUTES:
                raise ValueError("Unknown registered route")
            if not isinstance(identity, str) or not 0 < len(identity) <= 256:
                raise ValueError("A bound consumer identity is required")
            if not isinstance(query, str) or len(query) > self.LIMITS["max_query_characters"]:
                raise ValueError("Query exceeds supported size")
            response: dict[str, Any] = {"route": route, "identity": identity, "query": query,
                "documents": [], "checked_at": self._timestamp(), "coverage": "local_registered_routes",
                "status": "current", "reason": None}
            barrier = self._read_barrier()
            if barrier:
                response.update(status="blocked", reason=barrier)
                return response
            params: list[Any] = [self._namespace]
            sql = "SELECT * FROM sync_documents WHERE namespace=? AND verified=1 AND blocked_reason IS NULL"
            if document_id is not None:
                sql += " AND document_id=?"
                params.append(document_id)
            sql += " ORDER BY document_id"
            tokens = re.findall(r"\w+", query.casefold())
            for row in self._db.execute(sql, params).fetchall():
                acl = json.loads(row["acl_json"]) if row["acl_json"] is not None else None
                if acl is None or identity not in acl:
                    continue
                try:
                    content, chunk_ids = self._read_content(row["document_id"])
                    if _hash(content) != row["content_hash"]:
                        raise RuntimeError("Destination readback mismatch")
                except RuntimeError:
                    self._db.execute("UPDATE sync_documents SET verified=0,blocked_reason='index_integrity_failed' WHERE namespace=? AND document_id=?",
                                     (self._namespace, row["document_id"]))
                    self._db.execute("DELETE FROM sync_response_cache WHERE namespace=? AND document_id=?",
                                     (self._namespace, row["document_id"]))
                    response.update(status="blocked", reason="Registered index integrity check failed")
                    continue
                searchable = (row["title"] + " " + content).casefold()
                if tokens and not all(token in searchable for token in tokens):
                    continue
                payload = {"id": row["document_id"], "title": row["title"], "content": content,
                           "revision": row["revision"], "content_hash": row["content_hash"], "chunk_ids": chunk_ids}
                if route == "success":
                    cached = self._db.execute("SELECT * FROM sync_response_cache WHERE namespace=? AND document_id=? AND identity=?",
                                               (self._namespace, row["document_id"], identity)).fetchone()
                    if cached is not None and cached["fingerprint"] == row["fingerprint"]:
                        try:
                            candidate = json.loads(cached["payload_json"])
                        except (ValueError, TypeError):
                            candidate = None
                        # A cache is never the authority for content or ACL.
                        if candidate == payload:
                            payload = candidate
                    self._db.execute("INSERT OR REPLACE INTO sync_response_cache VALUES(?,?,?,?,?)",
                                     (self._namespace, row["document_id"], identity, row["fingerprint"], _json(payload)))
                response["documents"].append(payload)
                if len(response["documents"]) >= self.LIMITS["max_results"]:
                    break
            return response

    def status(self) -> dict[str, Any]:
        """Return coverage and operational metadata, never raw document content."""
        with self._lock:
            self._check_open()
            source = self._source_row()
            rows = self._db.execute("""
                SELECT d.*,COUNT(c.chunk_id) AS chunk_count FROM sync_documents d
                LEFT JOIN sync_chunks c ON c.namespace=d.namespace AND c.document_id=d.document_id
                WHERE d.namespace=? GROUP BY d.namespace,d.document_id ORDER BY d.document_id
            """, (self._namespace,)).fetchall()
            barrier = self._read_barrier()
            documents = []
            for row in rows:
                acl = json.loads(row["acl_json"]) if row["acl_json"] is not None else None
                state = "verified" if row["verified"] and not row["blocked_reason"] and not barrier else "blocked"
                documents.append({"id": row["document_id"], "title": row["title"], "revision": row["revision"],
                    "content_hash": row["content_hash"], "state": state,
                    "blocked_reason": row["blocked_reason"] or ("freshness_unknown" if barrier else None),
                    "updated_at": row["updated_at"], "verified_at": row["verified_at"],
                    "chunk_count": row["chunk_count"], "acl_known": acl is not None,
                    "allowed_identity_count": len(acl) if acl is not None else 0})
            jobs = [{key: row[key] for key in ("id", "document_id", "operation", "state", "attempts",
                       "expected_revision", "created_at", "updated_at", "error")}
                    for row in self._db.execute("SELECT * FROM sync_jobs WHERE namespace=? ORDER BY updated_at DESC,id LIMIT 30",
                                                 (self._namespace,))]
            counts = {row["state"]: row["count"] for row in self._db.execute(
                "SELECT state,COUNT(*) AS count FROM sync_jobs WHERE namespace=? GROUP BY state", (self._namespace,))}
            verified = sum(document["state"] == "verified" for document in documents)
            if source["last_observed_at"] is None:
                state = "not_started"
            elif barrier:
                state = "degraded"
            elif verified < len(documents):
                state = "blocked"
            else:
                state = "current"
            return {
                "mode": "automatic_sync", "status": state,
                "source": {"tenant_id": self.tenant_id, "connection_id": self.connection_id,
                    "last_observed_at": source["last_observed_at"], "last_complete_at": source["last_complete_at"],
                    "cursor": source["cursor"], "complete": bool(source["complete"]),
                    "error": source["error"], "generation": source["generation"]},
                "metrics": {"documents": len(documents), "chunks": sum(document["chunk_count"] for document in documents),
                    "verified_documents": verified, "blocked_documents": len(documents) - verified,
                    "pending_jobs": counts.get("planned", 0), "failed_jobs": counts.get("failed", 0),
                    "cached_documents": self._db.execute("SELECT COUNT(DISTINCT document_id) FROM sync_response_cache WHERE namespace=?",
                                                          (self._namespace,)).fetchone()[0],
                    "observed_changes": source["observed_changes"],
                    "sync_lag_seconds": None if source["last_complete_at"] is None else max(0, self._timestamp() - source["last_complete_at"])},
                "documents": documents,
                "routes": [{"id": route, "name": "Support retrieval" if route == "support" else "Customer success retrieval",
                            "cache_enabled": route == "success", "verified_documents": verified} for route in self.ROUTES],
                "jobs": jobs, "limits": {**self.LIMITS, "max_staleness_seconds": self.max_staleness_seconds},
            }

    def close(self) -> None:
        """Wait for any active tick, release resources, and reject future calls."""
        with self._lock:
            if not self._closed:
                self._release_worker()
                self._db.close()
                self._closed = True

    def __enter__(self) -> "SyncRuntime":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
