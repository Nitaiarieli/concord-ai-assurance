from dataclasses import dataclass, field, asdict

class Conflict(ValueError):
    """A stale or inconsistent command cannot be applied."""

@dataclass
class Artifact:
    id: str
    title: str
    kind: str
    parents: list[str] = field(default_factory=list)
    revision: int = 1
    acl: list[str] | None = None
    content: str = ""
    deleted: bool = False
    status: str = "current"
    source_revisions: dict[str, int] = field(default_factory=dict)
    containment_epoch: int = 0

    def public(self):
        value = asdict(self)
        value.pop("content")
        return value

@dataclass
class Change:
    id: str
    source_id: str
    kind: str
    identity: str
    source_revision: int
    epoch: int
    affected: list[str]
    stage: str = "contained"
    proof_id: str | None = None
    failure: str | None = None
