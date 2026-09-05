"""Atomic local snapshots for the single-process sandbox API."""
import json
import sqlite3
from dataclasses import asdict
from ..application.engine import AssuranceEngine
from ..domain.models import Artifact, Change
from .local_index import LocalIndex

class SQLiteStateStore:
    def __init__(self, path: str):
        self.db = sqlite3.connect(path)
        self.db.execute('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)')
        self.db.commit()

    def save(self, engine: AssuranceEngine):
        payload = {'artifacts':[asdict(a) for a in engine.artifacts.values()], 'records':engine.destination.records,
                   'events':[asdict(e) for e in engine.events.values()], 'proofs':engine.proofs,
                   'epoch':engine.epoch, 'idempotency':engine.idempotency}
        with self.db:
            self.db.execute('INSERT INTO state(id,payload) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
                            (json.dumps(payload),))

    def load(self) -> AssuranceEngine | None:
        row = self.db.execute('SELECT payload FROM state WHERE id=1').fetchone()
        if not row:
            return None
        data = json.loads(row[0])
        nodes = {a['id']:Artifact(**a) for a in data['artifacts']}
        engine = AssuranceEngine(nodes, LocalIndex(), initialize=False)
        engine.destination.records = data['records']
        engine.events = {e['id']:Change(**e) for e in data['events']}
        engine.proofs = data['proofs']
        engine.epoch = data['epoch']
        engine.idempotency = data['idempotency']
        return engine
