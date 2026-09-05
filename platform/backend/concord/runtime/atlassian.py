"""Read-only Atlassian Cloud observations through an existing OAuth access token.

These adapters implement bounded polling, not OAuth consent/refresh, webhooks,
effective end-user ACL resolution, attachment ingestion, or a deletion feed.
An exhausted listing is complete only for the API-visible configured scope.
"""
from __future__ import annotations

import re
import time
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit

from .models import Snapshot, SourceDocument
from .sources import SourceError, _JsonEndpoint, _PlainText, _acl, _digest, _env_value


def _bound(value: int, label: str, ceiling: int) -> int:
    if type(value) is not int or not 1 <= value <= ceiling:
        raise ValueError(f"{label} must be between 1 and {ceiling}")
    return value


def _text(value: Any, label: str, limit: int = 2048) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit \
            or any(ord(c) < 32 for c in value):
        raise SourceError(f"Invalid {label}")
    return value


def _ids(values: Any, label: str) -> list[str]:
    if not isinstance(values, list) or len(values) > 100:
        raise ValueError(f"{label} must be a list of at most 100 IDs")
    if any(isinstance(v, bool) or not re.fullmatch(r"[1-9][0-9]{0,19}", str(v)) for v in values):
        raise ValueError(f"Invalid {label}")
    result = [str(v) for v in values]
    if len(set(result)) != len(result):
        raise ValueError(f"Duplicate {label}")
    return sorted(result)


class _CloudSource:
    product: str

    def __init__(self, base_url: str, *, token_env: str = "ATLASSIAN_ACCESS_TOKEN",
                 operator_declared_access: bool = False,
                 allowed_identities: list[str] | None = None,
                 max_documents: int = 1000, max_pages: int = 20, page_size: int = 50,
                 max_scan_seconds: float = 30, timeout_seconds: float = 5,
                 max_bytes: int = 2_000_000, allow_loopback_http: bool = False):
        # The OAuth gateway is fixed. Source-controlled next URLs cannot redirect
        # credentials to another service. Literal loopback is for contract tests.
        if not isinstance(base_url, str):
            raise ValueError("base_url must be an Atlassian OAuth gateway URL")
        self.base_url = base_url.rstrip("/")
        _JsonEndpoint(self.base_url, allow_loopback_http=allow_loopback_http,
                      timeout_seconds=timeout_seconds, max_bytes=max_bytes)
        parsed = urlsplit(self.base_url)
        if parsed.query or parsed.fragment:
            raise ValueError("Atlassian base URL cannot have query parameters or a fragment")
        if parsed.scheme == "https" and (parsed.hostname != "api.atlassian.com"
                or parsed.port not in {None, 443}
                or not re.fullmatch(r"/ex/" + self.product + r"/[A-Za-z0-9-]{1,128}", parsed.path)):
            raise ValueError("Use the Atlassian OAuth gateway: https://api.atlassian.com/ex/product/cloud-id")
        if not isinstance(token_env, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,127}", token_env):
            raise ValueError("token_env must name an environment variable")
        self.token_env = token_env
        if type(operator_declared_access) is not bool:
            raise ValueError("operator_declared_access must be an explicit boolean")
        self.allowed_identities = _acl(allowed_identities)
        if self.allowed_identities is not None and len(self.allowed_identities) > 128:
            raise ValueError("At most 128 destination identities are supported")
        if operator_declared_access and self.allowed_identities is None:
            raise ValueError("Declared access requires an explicit destination identity list")
        if self.allowed_identities is not None and not operator_declared_access:
            raise ValueError("Identity grants require operator_declared_access=true")
        self.operator_declared_access = operator_declared_access
        self.max_documents = _bound(max_documents, "max_documents", 1000)
        self.max_pages = _bound(max_pages, "max_pages", 100)
        self.page_size = _bound(page_size, "page_size", 100)
        self.max_bytes = _bound(max_bytes, "max_bytes", 4_000_000)
        if isinstance(max_scan_seconds, bool) or not isinstance(max_scan_seconds, (int, float)) \
                or not 0 < max_scan_seconds <= 120:
            raise ValueError("max_scan_seconds must be between 0 and 120")
        self.max_scan_seconds = max_scan_seconds
        self.http_options = dict(allow_loopback_http=allow_loopback_http,
                                 timeout_seconds=timeout_seconds, max_bytes=max_bytes)

    def _get(self, path: str, query: dict[str, Any], authorization: str, deadline: float) -> Any:
        endpoint = _JsonEndpoint(self.base_url + path + "?" + urlencode(query, doseq=True), **self.http_options)
        return endpoint.get(authorization, timeout_seconds=deadline - time.monotonic())

    def _authorization(self) -> str:
        token = _env_value(self.token_env)
        if token is None or len(token) > 8192:
            raise SourceError("A bounded OAuth access token is required")
        return "Bearer " + token

    def _metadata(self) -> dict[str, Any]:
        return {"source_kind": self.product + "_cloud", "effective_authorization": "unknown",
                "acl_basis": "operator_declaration" if self.operator_declared_access else "unknown",
                "deletion_detection": "not_authoritative", "live_customer_validated": False}

    def _result(self, documents: list[SourceDocument], error: str | None = None) -> Snapshot:
        documents.sort(key=lambda d: d.id)
        return Snapshot(documents=documents, complete=error is None,
                        cursor=_digest([(d.id, d.revision) for d in documents]) if error is None else None,
                        error=error, deletion_authoritative=False)


class ConfluenceCloudSource(_CloudSource):
    """Poll current page text for explicit Confluence Cloud spaces or page IDs.

    Configure exactly one of space_ids/page_ids. Page IDs do not include children
    implicitly. Spaces discover API-visible current pages; attachments, comments,
    drafts and resolved macro content are outside the supported extraction scope.
    """
    product = "confluence"

    def __init__(self, base_url: str, *, space_ids: list[str | int] | None = None,
                 page_ids: list[str | int] | None = None, **options: Any):
        super().__init__(base_url, **options)
        self.space_ids = _ids([] if space_ids is None else space_ids, "space_ids")
        self.page_ids = _ids([] if page_ids is None else page_ids, "page_ids")
        if bool(self.space_ids) == bool(self.page_ids):
            raise ValueError("Configure exactly one nonempty list: space_ids or page_ids")

    def _page(self, page: Any) -> SourceDocument:
        if not isinstance(page, dict):
            raise SourceError("Unexpected Confluence page schema")
        page_id = _text(page.get("id"), "Confluence page ID", 128)
        space_id = _text(page.get("spaceId"), "Confluence space ID", 128)
        if not re.fullmatch(r"[1-9][0-9]{0,19}", page_id) or not re.fullmatch(r"[1-9][0-9]{0,19}", space_id):
            raise SourceError("Unexpected Confluence identifier schema")
        if (self.page_ids and page_id not in self.page_ids) or (self.space_ids and space_id not in self.space_ids):
            raise SourceError("Confluence returned a page outside the configured scope")
        if page.get("status") != "current":
            raise SourceError("Confluence returned a non-current page")
        title = _text(page.get("title"), "Confluence title")
        version = page.get("version")
        body = page.get("body")
        if not isinstance(version, dict) or type(version.get("number")) is not int or version["number"] < 1 \
                or not isinstance(body, dict) or not isinstance(body.get("storage"), dict) \
                or not isinstance(body["storage"].get("value"), str):
            raise SourceError("Confluence body or version schema is unsupported")
        parser = _PlainText()
        parser.feed(body["storage"]["value"])
        parser.close()
        content = " ".join("".join(parser.parts).split())
        metadata = self._metadata() | {"page_id": page_id, "space_id": space_id,
            "parent_id": page.get("parentId"), "provider_version": version["number"],
            "extraction": "storage_text_only; macros_and_attachments_not_resolved"}
        return SourceDocument(id="confluence:page:" + page_id, title=title, content=content,
                              revision=_digest([title, content, version["number"], metadata, self.allowed_identities]),
                              acl=self.allowed_identities, metadata=metadata)

    def _next_cursor(self, links: Any) -> str | None:
        if not isinstance(links, dict):
            raise SourceError("Confluence pagination metadata is missing")
        next_url = links.get("next")
        if next_url is None or next_url == "":
            return None
        next_url = _text(next_url, "Confluence next link", 8192)
        parsed = urlsplit(next_url)
        configured = urlsplit(self.base_url)
        if parsed.fragment or parsed.username is not None or parsed.password is not None:
            raise SourceError("Unsafe Confluence next link")
        if parsed.netloc and (parsed.scheme != configured.scheme or parsed.hostname != configured.hostname
                              or parsed.port != configured.port):
            raise SourceError("Cross-origin Confluence pagination is refused")
        if parsed.scheme and not parsed.netloc:
            raise SourceError("Invalid Confluence pagination origin")
        if parsed.path not in {"", "/wiki/api/v2/pages", configured.path + "/wiki/api/v2/pages"}:
            raise SourceError("Unexpected Confluence pagination path")
        query = parse_qs(parsed.query, keep_blank_values=True, max_num_fields=32)
        cursor = query.get("cursor")
        if not isinstance(cursor, list) or len(cursor) != 1:
            raise SourceError("Confluence pagination requires one cursor")
        return _text(cursor[0], "Confluence cursor", 2048)

    def scan(self) -> Snapshot:
        documents: list[SourceDocument] = []
        seen: set[str] = set()
        cursors: set[str] = set()
        deadline = time.monotonic() + self.max_scan_seconds
        try:
            authorization = self._authorization()
            query: dict[str, Any] = {"limit": self.page_size, "status": "current", "body-format": "storage"}
            query["space-id" if self.space_ids else "id"] = self.space_ids or self.page_ids
            for _ in range(self.max_pages):
                payload = self._get("/wiki/api/v2/pages", query, authorization, deadline)
                if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
                    raise SourceError("Unexpected Confluence listing schema")
                for value in payload["results"]:
                    document = self._page(value)
                    if document.id in seen or len(documents) >= self.max_documents:
                        raise SourceError("Confluence duplicate document or document limit exceeded")
                    seen.add(document.id)
                    documents.append(document)
                cursor = self._next_cursor(payload.get("_links"))
                if cursor is None:
                    return self._result(documents)
                if cursor in cursors:
                    raise SourceError("Confluence pagination cursor repeated")
                cursors.add(cursor)
                query["cursor"] = cursor
            raise SourceError("Confluence page limit reached before listing completed")
        except (SourceError, ValueError, RecursionError) as exc:
            message = str(exc) if isinstance(exc, SourceError) else "Confluence response cannot be interpreted safely"
            return self._result(documents, message)


def _adf_text(value: Any) -> tuple[str, list[str]]:
    if value is None:
        return "", []
    if isinstance(value, str):
        return value, []
    if not isinstance(value, dict) or value.get("type") != "doc" or type(value.get("version")) is not int or value.get("version") != 1:
        raise SourceError("Jira description must be text or Atlassian Document Format version 1")
    parts: list[str] = []
    omitted: set[str] = set()
    stack = [(value, 0)]
    nodes = 0
    containers = {"doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "codeBlock",
                  "blockquote", "panel", "table", "tableRow", "tableCell", "tableHeader", "expand", "nestedExpand"}
    while stack:
        node, depth = stack.pop()
        nodes += 1
        if nodes > 20000 or depth > 64 or not isinstance(node, dict):
            raise SourceError("Jira description structure exceeds supported bounds")
        kind = node.get("type")
        if kind == "text":
            if not isinstance(node.get("text"), str):
                raise SourceError("Invalid Jira text node")
            parts.append(node["text"])
        elif kind in containers:
            children = node.get("content", [])
            if not isinstance(children, list):
                raise SourceError("Invalid Jira description children")
            parts.append(" ")
            stack.extend((child, depth + 1) for child in reversed(children))
        elif kind in {"hardBreak", "rule"}:
            parts.append(" ")
        elif isinstance(kind, str) and len(kind) <= 128:
            # Embedded media, cards and mentions are not fetched or expanded.
            omitted.add(kind)
        else:
            raise SourceError("Unknown Jira description node schema")
    return " ".join("".join(parts).split()), sorted(omitted)


class JiraCloudSource(_CloudSource):
    """Poll Jira Cloud issue summary/description/status in explicit projects and optional JQL.

    Uses enhanced /search/jql, not the legacy search endpoint being removed.
    Search may lag writes. It does not establish deletion or effective user ACL.
    Comments, attachments, history and custom fields are excluded.
    """
    product = "jira"

    def __init__(self, base_url: str, project_keys: list[str], *, jql_filter: str | None = None, **options: Any):
        super().__init__(base_url, **options)
        if not isinstance(project_keys, list) or not 1 <= len(project_keys) <= 100 \
                or any(not isinstance(v, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]{0,49}", v) for v in project_keys) \
                or len(set(project_keys)) != len(project_keys):
            raise ValueError("project_keys requires one to 100 unique uppercase Jira project keys")
        self.project_keys = sorted(project_keys)
        self.jql_filter = None if jql_filter is None else _text(jql_filter, "JQL filter", 2048)
        # Project values are tightly validated and quoted; source data cannot alter scope.
        self.jql = "project in (" + ",".join('"' + key + '"' for key in self.project_keys) + ")"
        if self.jql_filter:
            self.jql += " AND (" + self.jql_filter + ")"
        self.jql += " ORDER BY id ASC"

    def _issue(self, issue: Any) -> SourceDocument:
        if not isinstance(issue, dict) or not isinstance(issue.get("fields"), dict):
            raise SourceError("Unexpected Jira issue schema")
        issue_id = _text(issue.get("id"), "Jira issue ID", 128)
        key = _text(issue.get("key"), "Jira issue key", 128)
        fields = issue["fields"]
        project = fields.get("project")
        if not re.fullmatch(r"[1-9][0-9]{0,19}", issue_id) or not isinstance(project, dict) \
                or project.get("key") not in self.project_keys or not key.startswith(project["key"] + "-"):
            raise SourceError("Jira returned an issue outside the configured project scope")
        title = _text(fields.get("summary"), "Jira summary")
        updated = _text(fields.get("updated"), "Jira updated timestamp", 128)
        if "description" not in fields:
            raise SourceError("Jira description field is missing")
        content, omitted = _adf_text(fields["description"])
        status_name = None
        if "status" in fields:
            status = fields["status"]
            if not isinstance(status, dict):
                raise SourceError("Unexpected Jira status schema")
            status_name = _text(status.get("name"), "Jira status name", 256)
            content = "Status: " + status_name + ("\n\n" + content if content else "")
        metadata = self._metadata() | {"issue_id": issue_id, "issue_key": key,
            "project_key": project["key"], "updated_at": updated,
            "extraction": "summary_description_and_returned_status_text", "omitted_adf_node_types": omitted,
            "status_name": status_name, "status_coverage": "returned" if status_name is not None else "not_returned",
            "provider_consistency": "search_eventual"}
        return SourceDocument(id="jira:issue:" + issue_id, title=title, content=content,
            revision=_digest([title, content, updated, metadata, self.allowed_identities]),
            acl=self.allowed_identities, metadata=metadata)

    def scan(self) -> Snapshot:
        documents: list[SourceDocument] = []
        seen: set[str] = set()
        tokens: set[str] = set()
        deadline = time.monotonic() + self.max_scan_seconds
        try:
            authorization = self._authorization()
            query: dict[str, Any] = {"jql": self.jql, "maxResults": self.page_size,
                                    "fields": "summary,description,status,updated,project"}
            for _ in range(self.max_pages):
                payload = self._get("/rest/api/3/search/jql", query, authorization, deadline)
                if not isinstance(payload, dict) or not isinstance(payload.get("issues"), list) \
                        or type(payload.get("isLast")) is not bool:
                    raise SourceError("Unexpected Jira enhanced-search pagination schema")
                for value in payload["issues"]:
                    document = self._issue(value)
                    if document.id in seen or len(documents) >= self.max_documents:
                        raise SourceError("Jira duplicate document or document limit exceeded")
                    seen.add(document.id)
                    documents.append(document)
                if payload["isLast"]:
                    if payload.get("nextPageToken") is not None and payload.get("nextPageToken") != "":
                        raise SourceError("Conflicting Jira pagination terminal state")
                    return self._result(documents)
                token = _text(payload.get("nextPageToken"), "Jira nextPageToken", 2048)
                if token in tokens:
                    raise SourceError("Jira pagination token repeated")
                tokens.add(token)
                query["nextPageToken"] = token
            raise SourceError("Jira page limit reached before listing completed")
        except (SourceError, ValueError, RecursionError) as exc:
            message = str(exc) if isinstance(exc, SourceError) else "Jira response cannot be interpreted safely"
            return self._result(documents, message)
