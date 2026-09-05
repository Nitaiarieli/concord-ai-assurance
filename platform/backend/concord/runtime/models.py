"""Provider-neutral, bounded-snapshot inputs for the local synchronization runtime.

Provider revisions are opaque strings. An ACL is an explicit list of identities;
None means unknown, [] means nobody, and there is no implicit public wildcard.
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class SourceDocument:
    id: str
    title: str
    content: str
    revision: str
    acl: list[str] | None
    schema_version: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Snapshot:
    """A fully traversed visible scope need not be an authoritative inventory.

    Set deletion_authoritative=False when a missing object may mean the
    connector lost visibility. The runtime retains and quarantines such objects.
    """

    documents: list[SourceDocument]
    complete: bool = True
    cursor: str | None = None
    error: str | None = None
    deletion_authoritative: bool = True
