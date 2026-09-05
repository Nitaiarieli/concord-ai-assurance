from copy import deepcopy

class LocalIndex:
    """Deterministic reference destination. It is not a vector database."""
    def __init__(self):
        self.records: dict[str, dict] = {}

    def write(self, artifact_id: str, record: dict) -> None:
        self.records[artifact_id] = deepcopy(record)

    def delete(self, artifact_id: str) -> None:
        self.records.pop(artifact_id, None)

    def read(self, artifact_id: str) -> dict | None:
        return deepcopy(self.records.get(artifact_id))

    def retrieve(self, artifact_id: str, identity: str) -> dict | None:
        record = self.records.get(artifact_id)
        if record and identity in record.get("acl", []):
            return deepcopy(record)
        return None
