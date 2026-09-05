"""Serializable source capabilities; no network, credentials or discovery claims."""
from .file_extractors import SUPPORTED_FILE_EXTENSIONS


def source_catalog() -> dict:
    return {
        "schema_version": 1,
        "runtime_scope": "one configured source per local worker instance",
        "sources": [
            {"type": "confluence_cloud", "mvp_priority": "first",
             "records": "API-visible current page text in explicit spaces or page IDs",
             "configuration": ["OAuth gateway base_url", "space_ids OR page_ids", "token_env"],
             "tested": "local HTTP contracts; no live Atlassian tenant",
             "effective_permissions": "unknown", "missing_object_policy": "quarantine",
             "excluded": ["OAuth consent/refresh", "attachments", "comments", "macros", "Data Center"]},
            {"type": "jira_cloud", "mvp_priority": "first",
             "records": "API-visible issues with description and returned status in explicit projects, optional JQL filter",
             "configuration": ["OAuth gateway base_url", "project_keys", "token_env"],
             "tested": "local HTTP contracts; no live Atlassian tenant",
             "effective_permissions": "unknown", "missing_object_policy": "quarantine",
             "excluded": ["OAuth consent/refresh", "attachments", "comments", "Data Center"]},
            {"type": "filesystem", "records": "supported regular files in a configured directory tree",
             "extensions": sorted(SUPPORTED_FILE_EXTENSIONS),
             "configuration": ["directory", "explicit identities or JSON ACL"],
             "tested": "real local files on Linux", "permissions": "explicit operator/data contract",
             "excluded": ["PDF", "OCR", "symlinks", "native Windows", "DOCX non-body parts"]},
            {"type": "json_http", "records": "explicit bounded snapshot document contract",
             "configuration": ["url", "optional token_env"], "tested": "local HTTP contracts",
             "permissions": "explicit producer ACL", "deletion_authority": "producer must explicitly assert true"},
            {"type": "bookstack", "mvp_priority": "technical legacy adapter",
             "records": "explicit page IDs only", "tested": "local HTTP contracts",
             "effective_permissions": "unknown"},
        ],
        "planned": ["Slack", "other enterprise application adapters", "cloud worker enrollment", "outbound tunnel", "external agent destinations"],
    }
