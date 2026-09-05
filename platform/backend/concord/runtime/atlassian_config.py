"""Strict JSON configuration boundary for the two Atlassian Cloud adapters."""
from __future__ import annotations

from typing import Any

from .atlassian import ConfluenceCloudSource, JiraCloudSource


def create_atlassian_source(config: dict[str, Any]) -> ConfluenceCloudSource | JiraCloudSource:
    options = dict(config)
    kind = options.pop("type", None)
    if kind == "confluence_cloud":
        return ConfluenceCloudSource(**options)
    if kind == "jira_cloud":
        return JiraCloudSource(**options)
    raise ValueError("Unknown Atlassian source type")


def normalize_atlassian_source(config: Any) -> dict[str, Any]:
    if not isinstance(config, dict) or config.get("type") not in {"confluence_cloud", "jira_cloud"}:
        raise ValueError("Invalid Atlassian source configuration")
    # Constructor checks scope, URL origin, token reference, identity declaration
    # and every bound without reading secrets or making a network request.
    adapter = create_atlassian_source(config)
    result = dict(config)
    result["base_url"] = adapter.base_url
    if result["type"] == "confluence_cloud":
        result.pop("space_ids", None)
        result.pop("page_ids", None)
        result["space_ids" if adapter.space_ids else "page_ids"] = adapter.space_ids or adapter.page_ids
    else:
        result["project_keys"] = adapter.project_keys
    return result
