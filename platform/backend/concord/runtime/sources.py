"""Read-only, bounded source adapters for the customer-side synchronization runtime.

Adapters return observations, never perform repairs, and never treat a failed or
partial observation as proof that an object was deleted. Network endpoints and
environment-variable names are trusted operator configuration, not source data.
"""
from __future__ import annotations

import hashlib
import http.client
import ipaddress
import json
import os
import re
import ssl
import stat
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .models import Snapshot, SourceDocument


class SourceError(ValueError):
    """Safe operational message; never contains a token or source response body."""


def _positive_int(value: int, label: str) -> int:
    if type(value) is not int or value < 1:
        raise ValueError(f"{label} must be a positive integer")
    return value


def _acl(value: Any) -> list[str] | None:
    if value is None:
        return None
    if not isinstance(value, list) or any(
        not isinstance(item, str) or not item.strip() or item == "*"
        or len(item) > 256 or any(ord(c) < 32 for c in item)
        for item in value
    ):
        raise SourceError("ACL must be null or explicit nonempty identity strings; wildcards are unsupported")
    return sorted(set(value))


def _digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def _strict_json(raw: bytes) -> Any:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise SourceError("Duplicate JSON object key")
            result[key] = value
        return result

    def invalid_constant(_value: str) -> None:
        raise SourceError("Non-finite JSON numbers are unsupported")

    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=unique,
                          parse_constant=invalid_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as exc:
        raise SourceError("Invalid UTF-8 JSON") from exc


def _document(value: Any, *, path: str | None = None) -> SourceDocument:
    if not isinstance(value, dict):
        raise SourceError("Document must be an object")
    if type(value.get("schema_version")) is not int or value["schema_version"] != 1:
        raise SourceError("Unsupported document schema_version; expected 1")
    if not {"id", "title", "content", "acl"}.issubset(value):
        raise SourceError("Document requires id, title, content and explicit acl")
    identity, title, content = value["id"], value["title"], value["content"]
    if not isinstance(identity, str) or not identity.strip() or len(identity) > 512:
        raise SourceError("Document id must be a nonempty string of at most 512 characters")
    if any(ord(c) < 32 for c in identity):
        raise SourceError("Document id must not contain control characters")
    if not isinstance(title, str) or not title.strip() or len(title) > 2048:
        raise SourceError("Document title must be a nonempty string of at most 2048 characters")
    if not isinstance(content, str):
        raise SourceError("Document content must be a string")
    access = _acl(value["acl"])
    metadata = value.get("metadata", {})
    if not isinstance(metadata, dict):
        raise SourceError("Document metadata must be an object")
    metadata = dict(metadata)
    if path is not None:
        metadata["relative_path"] = path
    revision = value.get("revision")
    if revision is not None and (not isinstance(revision, str) or not revision or len(revision) > 512):
        raise SourceError("Document revision must be a nonempty string when provided")
    return SourceDocument(id=identity, title=title, content=content,
                          revision=revision or _digest([title, content, access, metadata]),
                          acl=access, schema_version=1, metadata=metadata)


class FilesystemSource:
    """Poll one operator-selected directory; POSIX no-follow descriptor traversal.

    Markdown IDs are `file:<relative/path.md>`; a rename is delete plus add.
    JSON IDs are explicit and may not collide with any other discovered document.
    Hidden directories/files and other extensions are outside this source's scope.
    """

    def __init__(self, root: str | Path, identities: list[str] | None = None, *,
                 max_files: int = 1000, max_bytes: int = 2_000_000,
                 max_total_bytes: int = 20_000_000, max_entries: int = 10000,
                 max_depth: int = 16):
        self.root = Path(os.path.abspath(os.path.expanduser(str(root))))
        self.identities = _acl(identities)
        self.max_files = _positive_int(max_files, "max_files")
        self.max_bytes = _positive_int(max_bytes, "max_bytes")
        self.max_total_bytes = _positive_int(max_total_bytes, "max_total_bytes")
        self.max_entries = _positive_int(max_entries, "max_entries")
        self.max_depth = _positive_int(max_depth, "max_depth")

    def scan(self) -> Snapshot:
        documents: list[SourceDocument] = []
        identities: set[str] = set()
        errors: list[str] = []
        counts = {"entries": 0, "files": 0, "bytes": 0}
        if not hasattr(os, "O_NOFOLLOW") or os.open not in os.supports_dir_fd:
            return Snapshot(documents=[], complete=False,
                            error="Filesystem source requires POSIX no-follow directory descriptors; use Linux or Docker")

        def walk(directory_fd: int, relative: str, depth: int) -> None:
            # scandir avoids materializing an arbitrarily large directory listing.
            with os.scandir(directory_fd) as entries:
                for entry in entries:
                    counts["entries"] += 1
                    if counts["entries"] > self.max_entries:
                        raise SourceError("Directory entry limit exceeded")
                    if entry.name.startswith("."):
                        continue
                    path = f"{relative}/{entry.name}" if relative else entry.name
                    info = os.stat(entry.name, dir_fd=directory_fd, follow_symlinks=False)
                    if stat.S_ISLNK(info.st_mode):
                        raise SourceError("Symlink encountered; source scan is incomplete")
                    if stat.S_ISDIR(info.st_mode):
                        if depth >= self.max_depth:
                            raise SourceError("Directory depth limit exceeded")
                        child_fd = os.open(entry.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                           dir_fd=directory_fd)
                        try:
                            walk(child_fd, path, depth + 1)
                        finally:
                            os.close(child_fd)
                        continue
                    if Path(entry.name).suffix.lower() not in {".md", ".json"}:
                        continue
                    if not stat.S_ISREG(info.st_mode):
                        raise SourceError("Source document is not a regular file")
                    counts["files"] += 1
                    if counts["files"] > self.max_files:
                        raise SourceError("Document count limit exceeded")
                    # O_NONBLOCK ensures a concurrent file-to-FIFO replacement cannot hang open.
                    fd = os.open(entry.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                                 dir_fd=directory_fd)
                    try:
                        before = os.fstat(fd)
                        if not stat.S_ISREG(before.st_mode):
                            raise SourceError("Source document changed type during scan")
                        if before.st_size > self.max_bytes:
                            raise SourceError("Document byte limit exceeded")
                        with os.fdopen(fd, "rb", closefd=False) as stream:
                            raw = stream.read(self.max_bytes + 1)
                        after = os.fstat(fd)
                        linked = os.stat(entry.name, dir_fd=directory_fd, follow_symlinks=False)
                        if (before.st_dev, before.st_ino, before.st_mtime_ns, before.st_size) != (
                            after.st_dev, after.st_ino, after.st_mtime_ns, after.st_size
                        ) or (after.st_dev, after.st_ino) != (linked.st_dev, linked.st_ino):
                            raise SourceError("Source document changed during scan; retry required")
                    finally:
                        os.close(fd)
                    counts["bytes"] += len(raw)
                    if len(raw) > self.max_bytes or counts["bytes"] > self.max_total_bytes:
                        raise SourceError("Source byte limit exceeded")
                    if Path(entry.name).suffix.lower() == ".json":
                        document = _document(_strict_json(raw), path=path)
                    else:
                        try:
                            content = raw.decode("utf-8")
                        except UnicodeDecodeError as exc:
                            raise SourceError("Markdown must be UTF-8") from exc
                        heading = next((line.lstrip("# ").strip() for line in content.splitlines()
                                        if line.startswith("# ") and line.lstrip("# ").strip()),
                                       Path(entry.name).stem)
                        document = SourceDocument(id="file:" + path, title=heading[:2048],
                                                  content=content, revision=_digest([content, self.identities]),
                                                  acl=self.identities, schema_version=1,
                                                  metadata={"relative_path": path, "acl_basis": "operator_configuration"})
                    if document.id in identities:
                        raise SourceError("Duplicate document ID; source scan is incomplete")
                    identities.add(document.id)
                    documents.append(document)

        try:
            # Open every configured path component without following symlinks.
            root_fd = os.open(self.root.anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                for component in self.root.parts[1:]:
                    next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                      dir_fd=root_fd)
                    os.close(root_fd)
                    root_fd = next_fd
                walk(root_fd, "", 0)
            finally:
                os.close(root_fd)
        except SourceError as exc:
            errors.append(str(exc))
        except OSError:
            errors.append("Source filesystem could not be read completely")
        # Sorting provides deterministic snapshots independent of directory enumeration order.
        documents.sort(key=lambda document: document.id)
        return Snapshot(documents=documents, complete=not errors,
                        cursor=_digest([(d.id, d.revision) for d in documents]) if not errors else None,
                        error="; ".join(errors) or None)


class _JsonEndpoint:
    def __init__(self, url: str, *, allow_loopback_http: bool = False,
                 timeout_seconds: float = 10, max_bytes: int = 4_000_000):
        try:
            parsed = urlsplit(url)
            port = parsed.port
        except (ValueError, TypeError) as exc:
            raise ValueError("Invalid source endpoint URL") from exc
        if (not parsed.hostname or parsed.username is not None or parsed.password is not None
                or parsed.fragment or any(ord(c) < 32 for c in url)):
            raise ValueError("Endpoint must have a hostname and no userinfo, fragment or control characters")
        if parsed.scheme != "https":
            loopback = False
            try:
                loopback = ipaddress.ip_address(parsed.hostname).is_loopback
            except ValueError:
                pass
            if not (parsed.scheme == "http" and allow_loopback_http and loopback):
                raise ValueError("HTTPS is required; explicit literal loopback HTTP is for local tests only")
        if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, (int, float)) or not 0 < timeout_seconds <= 120:
            raise ValueError("timeout_seconds must be between 0 and 120")
        self.parsed = parsed
        self.port = port
        self.timeout_seconds = float(timeout_seconds)
        self.max_bytes = _positive_int(max_bytes, "max_bytes")

    def get(self, authorization: str | None = None, *, timeout_seconds: float | None = None) -> Any:
        if authorization is not None and (not authorization or any(ord(c) < 32 for c in authorization)):
            raise SourceError("Invalid authorization environment value")
        timeout = min(self.timeout_seconds, timeout_seconds) if timeout_seconds is not None else self.timeout_seconds
        if timeout <= 0:
            raise SourceError("Source scan deadline exceeded")
        connection: http.client.HTTPConnection
        if self.parsed.scheme == "https":
            connection = http.client.HTTPSConnection(self.parsed.hostname, self.port,
                         timeout=timeout, context=ssl.create_default_context())
        else:
            connection = http.client.HTTPConnection(self.parsed.hostname, self.port,
                                                     timeout=timeout)
        target = self.parsed.path or "/"
        if self.parsed.query:
            target += "?" + self.parsed.query
        headers = {"Accept": "application/json", "Accept-Encoding": "identity", "User-Agent": "ConcordRuntime/1"}
        if authorization is not None:
            headers["Authorization"] = authorization
        deadline = time.monotonic() + timeout
        try:
            connection.request("GET", target, headers=headers)
            with connection.getresponse() as response:
                # http.client does not follow redirects; no credential is sent to Location.
                if response.status != 200:
                    raise SourceError(f"Source returned HTTP {response.status}; no deletion inferred")
                media_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
                if media_type != "application/json" and not media_type.endswith("+json"):
                    raise SourceError("Source response must use a JSON Content-Type")
                if response.getheader("Content-Encoding", "identity").lower() != "identity":
                    raise SourceError("Compressed source responses are unsupported")
                length = response.getheader("Content-Length")
                if length is not None and (not length.isdigit() or int(length) > self.max_bytes):
                    raise SourceError("Source response byte limit exceeded or invalid Content-Length")
                parts: list[bytes] = []
                size = 0
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise SourceError("Source response deadline exceeded")
                    # The socket may be detached from the connection on Connection: close.
                    # read1 performs one bounded socket read; check total deadline between reads.
                    raw_socket = connection.sock or getattr(getattr(response.fp, "raw", None), "_sock", None)
                    if raw_socket is not None:
                        raw_socket.settimeout(remaining)
                    chunk = response.read1(min(65536, self.max_bytes + 1 - size))
                    if not chunk:
                        break
                    parts.append(chunk)
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise SourceError("Source response byte limit exceeded")
                if length is not None and size != int(length):
                    raise SourceError("Source response was truncated; no deletion inferred")
                return _strict_json(b"".join(parts))
        except SourceError:
            raise
        except (OSError, http.client.HTTPException, UnicodeError, ValueError) as exc:
            raise SourceError("Source request failed or timed out; no deletion inferred") from exc
        finally:
            connection.close()


def _env_value(name: str | None) -> str | None:
    if name is None:
        return None
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        raise SourceError("Invalid credential environment-variable name")
    value = os.environ.get(name)
    if not value:
        raise SourceError("Required credential environment variable is not set")
    if any(ord(c) < 32 for c in value):
        raise SourceError("Credential environment value contains control characters")
    return value


class JsonHttpSnapshotSource:
    """Read the fixed operator-configured complete snapshot endpoint.

    Contract: {schema_version:1, complete:true|false, documents:[...], cursor?:str}.
    `complete:true` is a producer assertion about configured scope, not discovery
    of systems outside that endpoint. This adapter does not follow pagination.
    """

    def __init__(self, url: str, *, token_env: str | None = None,
                 max_documents: int = 1000, **http_options: Any):
        self.endpoint = _JsonEndpoint(url, **http_options)
        self.token_env = token_env
        self.max_documents = _positive_int(max_documents, "max_documents")

    def scan(self) -> Snapshot:
        try:
            token = _env_value(self.token_env)
            payload = self.endpoint.get("Bearer " + token if token is not None else None)
            if not isinstance(payload, dict) or type(payload.get("schema_version")) is not int or payload["schema_version"] != 1:
                raise SourceError("Unsupported snapshot schema_version; expected 1")
            if type(payload.get("complete")) is not bool:
                raise SourceError("Snapshot must explicitly declare complete true or false")
            if not isinstance(payload.get("documents"), list) or len(payload["documents"]) > self.max_documents:
                raise SourceError("Snapshot documents missing, invalid or over limit")
            if payload.get("error"):
                raise SourceError("Source producer reported an incomplete snapshot")
            cursor = payload.get("cursor")
            if cursor is not None and (not isinstance(cursor, str) or len(cursor) > 2048):
                raise SourceError("Snapshot cursor must be a bounded string or null")
            documents = [_document(value) for value in payload["documents"]]
            if len({d.id for d in documents}) != len(documents):
                raise SourceError("Duplicate document ID in source snapshot")
            complete = payload["complete"]
            return Snapshot(documents=documents, complete=complete, cursor=cursor if complete else None,
                            error=None if complete else "Source producer reported a partial snapshot")
        except SourceError as exc:
            return Snapshot(documents=[], complete=False, error=str(exc))


class _PlainText(HTMLParser):
    """Extract text only; never render or execute untrusted BookStack HTML."""
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.hidden += 1
        if tag in {"p", "div", "br", "li", "h1", "h2", "h3", "td", "tr"}:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)
        self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


class BookStackSource:
    """Poll only configured page IDs; page visibility is not effective user ACL.

    No automatic page inventory, ACL resolution, attachment fetching or deletion
    detection is claimed. Failed reads make the snapshot incomplete. Public mode
    is an operator declaration, restricted to explicit destination identities.
    """

    def __init__(self, base_url: str, page_ids: list[int | str], *,
                 token_id_env: str = "BOOKSTACK_TOKEN_ID",
                 token_secret_env: str = "BOOKSTACK_TOKEN_SECRET",
                 public_content: bool = False, public_identities: list[str] | None = None,
                 max_pages: int = 100, max_scan_seconds: float = 120, **http_options: Any):
        _positive_int(max_pages, "max_pages")
        if (isinstance(max_scan_seconds, bool) or not isinstance(max_scan_seconds, (int, float))
                or not 0 < max_scan_seconds <= 120):
            raise ValueError("max_scan_seconds must be between 0 and 120")
        if not isinstance(page_ids, list) or not page_ids or len(page_ids) > max_pages:
            raise ValueError("BookStack requires a bounded, nonempty list of explicit page IDs")
        if any(isinstance(value, bool) or not re.fullmatch(r"[1-9][0-9]*", str(value)) for value in page_ids):
            raise ValueError("BookStack page IDs must be positive integers")
        self.page_ids = [str(value) for value in page_ids]
        if len(set(self.page_ids)) != len(self.page_ids):
            raise ValueError("Duplicate BookStack page IDs")
        if type(public_content) is not bool:
            raise ValueError("public_content must be an explicit boolean")
        self.public_identities = _acl(public_identities)
        if public_content and not self.public_identities:
            raise ValueError("Declared public content requires explicit destination identities")
        if self.public_identities is not None and not public_content:
            raise ValueError("Public identities require an explicit public_content declaration")
        parsed = urlsplit(base_url)
        if parsed.query or parsed.fragment:
            raise ValueError("BookStack base URL cannot have query or fragment")
        self.endpoints = [_JsonEndpoint(base_url.rstrip("/") + "/api/pages/" + value,
                                       **http_options) for value in self.page_ids]
        self.token_id_env = token_id_env
        self.token_secret_env = token_secret_env
        self.public_content = public_content
        self.max_scan_seconds = float(max_scan_seconds)

    def scan(self) -> Snapshot:
        documents: list[SourceDocument] = []
        deadline = time.monotonic() + self.max_scan_seconds
        try:
            token_id = _env_value(self.token_id_env)
            token_secret = _env_value(self.token_secret_env)
            if token_id is None or token_secret is None or ":" in token_id or ":" in token_secret:
                raise SourceError("BookStack token components are required and cannot contain colon")
            authorization = "Token " + token_id + ":" + token_secret
            for page_id, endpoint in zip(self.page_ids, self.endpoints):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise SourceError("BookStack aggregate scan deadline exceeded")
                page = endpoint.get(authorization, timeout_seconds=remaining)
                if (not isinstance(page, dict) or type(page.get("id")) is not int
                        or str(page["id"]) != page_id or not isinstance(page.get("name"), str)
                        or not page["name"].strip() or not isinstance(page.get("html"), str)
                        or not isinstance(page.get("updated_at"), str)):
                    raise SourceError("Unexpected BookStack page response schema")
                parser = _PlainText()
                parser.feed(page["html"])
                parser.close()
                content = " ".join("".join(parser.parts).split())
                metadata = {"source_kind": "bookstack", "page_id": page_id,
                            "updated_at": page["updated_at"],
                            "book_id": page.get("book_id"), "chapter_id": page.get("chapter_id"),
                            "effective_authorization": "unknown",
                            "acl_basis": "operator_declared_public_content" if self.public_content else "unknown",
                            "live_customer_validated": False}
                documents.append(SourceDocument(id="bookstack:page:" + page_id, title=page["name"],
                    content=content, revision=_digest([page["updated_at"], page["name"], content, metadata]),
                    acl=self.public_identities if self.public_content else None, schema_version=1, metadata=metadata))
            return Snapshot(documents=documents, complete=True,
                            cursor=_digest([(d.id, d.revision) for d in documents]))
        except SourceError as exc:
            return Snapshot(documents=documents, complete=False, error=str(exc))


# Friendly alias accepted by operators who name this source by its wire format.
HTTPJSONSource = JsonHttpSnapshotSource
