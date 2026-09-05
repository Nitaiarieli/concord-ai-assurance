"""Automatic source-to-index synchronization; customer adapters are explicit."""
from .core import SyncRuntime
from .models import Snapshot, SourceDocument

__all__ = ["Snapshot", "SourceDocument", "SyncRuntime"]
