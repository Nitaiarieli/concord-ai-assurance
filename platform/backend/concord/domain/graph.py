from .models import Artifact, Conflict
from collections import deque

class Lineage:
    """Explicit acyclic lineage. Only registered descendants are in scope."""
    def __init__(self, artifacts: dict[str, Artifact]):
        self.artifacts = artifacts
        self.children: dict[str, set[str]] = {key: set() for key in artifacts}
        for key, artifact in artifacts.items():
            if key != artifact.id:
                raise Conflict("Artifact identity must match its registry key")
            if artifact.kind == "source" and artifact.parents:
                raise Conflict("Authoritative sources cannot have derivative parents")
            for parent in artifact.parents:
                if parent not in artifacts:
                    raise Conflict("Every parent must be registered")
                self.children[parent].add(artifact.id)
        for key in artifacts:
            self.sources(key)

    def descendants(self, root: str) -> list[str]:
        seen, ordered, queue = set(), [], deque(sorted(self.children[root]))
        while queue:
            key = queue.popleft()
            if key in seen:
                continue
            seen.add(key)
            ordered.append(key)
            queue.extend(sorted(self.children[key]))
        return ordered

    def sources(self, key: str, trail: frozenset[str] = frozenset()) -> set[str]:
        if key in trail:
            raise Conflict("Lineage cycles are not allowed")
        node = self.artifacts[key]
        if node.kind == "source":
            return {key}
        result: set[str] = set()
        for parent in node.parents:
            result.update(self.sources(parent, trail | {key}))
        if not result:
            raise Conflict("A derivative must have a source")
        return result

    def revisions(self, key: str) -> dict[str, int]:
        return {source: self.artifacts[source].revision for source in sorted(self.sources(key))}

    def allowed(self, key: str, identity: str) -> bool:
        return all(not self.artifacts[source].deleted and self.artifacts[source].acl is not None
                   and identity in self.artifacts[source].acl for source in self.sources(key))
