"""Create and run an explicitly scoped, single-tenant Concord deployment."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import sys
import threading
from typing import Any
from urllib.parse import urlsplit

from .server import AccessPolicy, ConsumerCredential, RuntimeService

MAX_CONFIG_BYTES = 65536
MAX_SECRETS_BYTES = 32768
_ENV_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]{0,127}\Z")


class ConfigurationError(ValueError):
    """Operator-safe configuration error: never contains credential values."""


def _strict_json(raw: bytes) -> Any:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result = {}
        for key, value in pairs:
            if key in result:
                raise ConfigurationError("Duplicate JSON keys are not supported")
            result[key] = value
        return result

    def constant(_value: str) -> None:
        raise ConfigurationError("Non-finite JSON numbers are not supported")

    try:
        return json.loads(raw, object_pairs_hook=unique, parse_constant=constant)
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise ConfigurationError("Configuration must be valid UTF-8 JSON") from exc


def _read_json(path: Path, limit: int, *, private: bool = False) -> Any:
    try:
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
        descriptor = os.open(path, flags)
        try:
            metadata = os.fstat(descriptor)
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > limit:
                raise ConfigurationError("Configuration file is not regular or exceeds its size limit")
            if private and os.name == "posix" and (metadata.st_mode & 0o077):
                raise ConfigurationError("Credential file must have owner-only permissions (chmod 600)")
            with os.fdopen(descriptor, "rb", closefd=False) as stream:
                raw = stream.read(limit + 1)
            if len(raw) > limit:
                raise ConfigurationError("Configuration file exceeds its size limit")
        finally:
            os.close(descriptor)
    except OSError as exc:
        raise ConfigurationError("Configuration or credential file cannot be read safely") from exc
    return _strict_json(raw)


def _keys(obj: Any, allowed: set[str], required: set[str], label: str) -> dict[str, Any]:
    if not isinstance(obj, dict) or not required <= set(obj) or set(obj) - allowed:
        raise ConfigurationError(f"Invalid or unsupported {label} fields")
    return obj


def _text(value: Any, label: str, *, limit: int = 128) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit \
            or any(ord(c) < 32 for c in value):
        raise ConfigurationError(f"Invalid {label}")
    return value


def _path(value: Any, base: Path, label: str) -> Path:
    text = _text(value, label, limit=4096)
    expanded = Path(os.path.expanduser(text))
    result = Path(os.path.abspath(expanded if expanded.is_absolute() else base / expanded))
    if result == Path(result.anchor):
        raise ConfigurationError(f"{label} cannot be the filesystem root")
    return result


def _number(value: Any, label: str, minimum: float, maximum: float, *, integer: bool = False) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) \
            or not minimum <= value <= maximum or (integer and not isinstance(value, int)):
        raise ConfigurationError(f"{label} is outside the supported range")
    return value


def _identities(value: Any) -> list[str] | None:
    if value is None:
        return None
    if not isinstance(value, list) or len(value) > 128:
        raise ConfigurationError("Identities must be an explicit bounded list or null")
    for item in value:
        _text(item, "identity", limit=128)
        if item == "*":
            raise ConfigurationError("Wildcard identity grants are unsupported")
    return sorted(set(value))


def normalize_source(source: Any, base: Path) -> dict[str, Any]:
    _keys(source, {
        "type", "directory", "identities", "max_files", "max_bytes", "max_total_bytes", "max_entries", "max_depth",
        "url", "token_env", "max_documents", "allow_loopback_http", "timeout_seconds",
        "base_url", "page_ids", "token_id_env", "token_secret_env", "public_content", "public_identities", "max_pages", "max_scan_seconds",
    }, {"type"}, "source")
    kind = source["type"]
    bounds = {"max_files": 1000, "max_bytes": 4_000_000, "max_total_bytes": 20_000_000,
              "max_entries": 10000, "max_depth": 16, "max_documents": 1000, "max_pages": 100}
    if kind == "filesystem":
        allowed = {"type", "directory", "identities", "max_files", "max_bytes", "max_total_bytes", "max_entries", "max_depth"}
        _keys(source, allowed, {"type", "directory"}, "filesystem source")
        normalized = {"type": kind, "directory": str(_path(source["directory"], base, "source directory")),
                      "identities": _identities(source.get("identities"))}
    elif kind in {"json_http", "bookstack"}:
        common = {"type", "allow_loopback_http", "timeout_seconds", "max_bytes"}
        allowed = common | ({"url", "token_env", "max_documents"} if kind == "json_http" else
                            {"base_url", "page_ids", "token_id_env", "token_secret_env", "public_content", "public_identities", "max_pages", "max_scan_seconds"})
        _keys(source, allowed, {"type", "url"} if kind == "json_http" else {"type", "base_url", "page_ids"}, "HTTP source")
        url_key = "url" if kind == "json_http" else "base_url"
        endpoint = _text(source[url_key], "source endpoint", limit=2048)
        parsed = urlsplit(endpoint)
        if parsed.query or parsed.fragment or parsed.username is not None or parsed.password is not None:
            raise ConfigurationError("Source endpoint cannot contain query parameters, fragments or credentials")
        normalized = dict(source)
        normalized[url_key] = endpoint
        for env_key in {"token_env", "token_id_env", "token_secret_env"} & source.keys():
            if not isinstance(source[env_key], str) or not _ENV_NAME.fullmatch(source[env_key]):
                raise ConfigurationError("Source credentials must use environment-variable names")
        if "allow_loopback_http" in source and type(source["allow_loopback_http"]) is not bool:
            raise ConfigurationError("allow_loopback_http must be an explicit boolean")
        normalized["timeout_seconds"] = _number(source.get("timeout_seconds", 3), "source timeout", 0.1, 30)
        if kind == "bookstack":
            normalized["max_scan_seconds"] = _number(source.get("max_scan_seconds", 30), "scan timeout", 0.1, 120)
            if not isinstance(source["page_ids"], list) or not 1 <= len(source["page_ids"]) <= 100:
                raise ConfigurationError("BookStack requires one to 100 explicit page IDs")
            if any(isinstance(v, bool) or not re.fullmatch(r"[1-9][0-9]{0,18}", str(v)) for v in source["page_ids"]):
                raise ConfigurationError("Invalid BookStack page ID")
            normalized["page_ids"] = sorted({str(v) for v in source["page_ids"]})
            if len(normalized["page_ids"]) != len(source["page_ids"]):
                raise ConfigurationError("BookStack page IDs must be unique")
            if "public_content" in source and type(source["public_content"]) is not bool:
                raise ConfigurationError("public_content must be an explicit boolean")
            if "public_identities" in source:
                normalized["public_identities"] = _identities(source["public_identities"])
    else:
        raise ConfigurationError("Supported source types are filesystem, json_http and bookstack")
    for key in bounds.keys() & source.keys():
        normalized[key] = _number(source[key], key, 1, bounds[key], integer=True)
    return normalized


def create_source(config: dict[str, Any]) -> Any:
    from .sources import BookStackSource, FilesystemSource, JsonHttpSnapshotSource
    source = dict(config)
    kind = source.pop("type")
    try:
        if kind == "filesystem":
            return FilesystemSource(source.pop("directory"), **source)
        if kind == "json_http":
            return JsonHttpSnapshotSource(**source)
        return BookStackSource(**source)
    except (ValueError, TypeError, OSError) as exc:
        raise ConfigurationError("Source configuration is invalid; check the supported adapter contract") from exc


def load_config(path: str | Path) -> tuple[dict[str, Any], AccessPolicy]:
    config_path = Path(os.path.abspath(path))
    config = _keys(_read_json(config_path, MAX_CONFIG_BYTES), {
        "schema_version", "tenant_id", "connection_id", "database", "credentials_file", "poll_interval_seconds", "port", "source",
    }, {"schema_version", "tenant_id", "connection_id", "database", "credentials_file", "source"}, "runtime configuration")
    if type(config["schema_version"]) is not int or config["schema_version"] != 1:
        raise ConfigurationError("Unsupported runtime configuration schema_version")
    normalized = dict(config)
    normalized["tenant_id"] = _text(config["tenant_id"], "tenant_id")
    normalized["connection_id"] = _text(config["connection_id"], "connection_id")
    normalized["database"] = str(_path(config["database"], config_path.parent, "database path"))
    normalized["credentials_file"] = str(_path(config["credentials_file"], config_path.parent, "credential path"))
    normalized["source"] = normalize_source(config["source"], config_path.parent)
    normalized["poll_interval_seconds"] = _number(config.get("poll_interval_seconds", 2), "poll interval", 1, 3600)
    normalized["port"] = _number(config.get("port", 8080), "port", 1, 65535, integer=True)
    if len({str(config_path), normalized["database"], normalized["credentials_file"]}) != 3:
        raise ConfigurationError("Configuration, database and credentials must use different paths")
    if normalized["source"]["type"] == "filesystem":
        source_path = Path(normalized["source"]["directory"])
        for local_path in (config_path, Path(normalized["database"]), Path(normalized["credentials_file"])):
            if local_path == source_path or source_path in local_path.parents:
                raise ConfigurationError("Source directory must not contain runtime configuration, state or credentials")
    secret = _keys(_read_json(Path(normalized["credentials_file"]), MAX_SECRETS_BYTES, private=True),
                   {"schema_version", "operator_token", "consumers"},
                   {"schema_version", "operator_token", "consumers"}, "credential configuration")
    if type(secret["schema_version"]) is not int or secret["schema_version"] != 1 or not isinstance(secret["consumers"], dict):
        raise ConfigurationError("Invalid credential configuration schema")
    consumers = []
    for credential in secret["consumers"].values():
        credential = _keys(credential, {"token", "identity", "route"}, {"token", "identity", "route"}, "consumer credential")
        consumers.append(ConsumerCredential(_text(credential["token"], "consumer token", limit=256),
                                           _text(credential["identity"], "consumer identity"),
                                           _text(credential["route"], "consumer route")))
    try:
        policy = AccessPolicy(_text(secret["operator_token"], "operator token", limit=256), tuple(consumers))
    except (ValueError, TypeError) as exc:
        raise ConfigurationError("Invalid runtime credential policy") from exc
    return normalized, policy


def _exclusive_json(path: Path, value: Any, mode: int = 0o600) -> None:
    data = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(descriptor, "wb", closefd=False) as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
    finally:
        os.close(descriptor)


def initialize(directory: str | Path) -> Path:
    root = Path(os.path.abspath(directory))
    if root.exists():
        if root.is_symlink() or not root.is_dir() or any(root.iterdir()):
            raise ConfigurationError("Initialization requires a new or empty non-symlink directory; nothing was overwritten")
    else:
        root.mkdir(parents=True, mode=0o700)
    try:
        (root / "source").mkdir(mode=0o700)
        (root / "state").mkdir(mode=0o700)
        _exclusive_json(root / "source" / "product-policy.json", {
            "schema_version": 1,
            "id": "product-policy",
            "title": "Product support policy",
            "content": "The Atlas plan includes 30 days of product support. This is example data; edit this file in your own editor.",
            "acl": ["alex", "jordan"],
        })
        _exclusive_json(root / "source" / "team-handbook.json", {
            "schema_version": 1, "id": "team-handbook", "title": "Team handbook",
            "content": "The support team meets every Tuesday. This is an unrelated example document.",
            "acl": ["alex", "jordan"],
        })
        credentials = {
            "schema_version": 1,
            "operator_token": secrets.token_urlsafe(32),
            "consumers": {
                "alex_support": {"token": secrets.token_urlsafe(32), "identity": "alex", "route": "support"},
                "jordan_success": {"token": secrets.token_urlsafe(32), "identity": "jordan", "route": "success"},
            },
        }
        _exclusive_json(root / "credentials.local.json", credentials)
        _exclusive_json(root / "runtime.json", {
            "schema_version": 1, "tenant_id": "local", "connection_id": "source",
            "database": "state/concord.sqlite3", "credentials_file": "credentials.local.json",
            "poll_interval_seconds": 2, "port": 8080,
            "source": {"type": "filesystem", "directory": "source"},
        })
        with (root / ".gitignore").open("x", encoding="utf-8") as stream:
            stream.write("credentials.local.json\nstate/\n")
    except FileExistsError as exc:
        raise ConfigurationError("Initialization encountered an existing file; no existing file was overwritten") from exc
    return root / "runtime.json"


class DatabaseLease:
    """OS-level process lock plus explicit source/tenant binding for durable state."""
    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.path = Path(config["database"])
        self._fd: int | None = None

    def __enter__(self) -> DatabaseLease:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.path.is_symlink() or not self.path.parent.is_dir():
            raise ConfigurationError("State database must use a regular local path")
        lock_path = self.path.with_name(self.path.name + ".lock")
        try:
            self._fd = os.open(lock_path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
            if os.name == "posix":
                import fcntl
                fcntl.flock(self._fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            else:
                import msvcrt
                os.write(self._fd, b"\0")
                os.lseek(self._fd, 0, os.SEEK_SET)
                msvcrt.locking(self._fd, msvcrt.LK_NBLCK, 1)
        except (OSError, ImportError) as exc:
            if self._fd is not None:
                os.close(self._fd)
                self._fd = None
            raise ConfigurationError("Runtime state is already in use or cannot be locked safely") from exc
        try:
            binding_path = self.path.with_name(self.path.name + ".binding.json")
            fingerprint = hashlib.sha256(json.dumps({
                "source": self.config["source"], "tenant_id": self.config["tenant_id"],
                "connection_id": self.config["connection_id"],
            }, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            binding = {"schema_version": 1, "source_configuration_sha256": fingerprint}
            if binding_path.exists():
                if _read_json(binding_path, 4096, private=True) != binding:
                    raise ConfigurationError("State is bound to another source or tenant configuration; choose a new database path")
            elif self.path.exists():
                raise ConfigurationError("Existing database has no verified source binding; choose a new database path")
            else:
                _exclusive_json(binding_path, binding)
            # SQLite inherits the owner-only file; umask is not changed globally.
            if not self.path.exists():
                fd = os.open(self.path, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
                os.close(fd)
            elif os.name == "posix" and self.path.stat().st_mode & 0o077:
                raise ConfigurationError("State database requires owner-only permissions (chmod 600)")
        except Exception:
            self.__exit__(None, None, None)
            raise
        return self

    def __exit__(self, *_: Any) -> None:
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None


def run(config_path: str | Path) -> None:
    from .core import SyncRuntime
    config, policy = load_config(config_path)
    source = create_source(config["source"])
    stop = threading.Event()
    previous_handlers = {}

    def request_stop(_signum: int, _frame: Any) -> None:
        stop.set()

    with DatabaseLease(config):
        runtime = SyncRuntime(database=config["database"], source=source,
                              tenant_id=config["tenant_id"], connection_id=config["connection_id"])
        service = None
        try:
            service = RuntimeService(runtime, policy, port=config["port"], poll_interval=config["poll_interval_seconds"])
            for sig in (signal.SIGINT, signal.SIGTERM):
                previous_handlers[sig] = signal.signal(sig, request_stop)
            service.start()
            print(f"Concord local runtime: {service.url}", flush=True)
            print("Edit the connected source outside Concord. Credentials are in the configured owner-only local file.", flush=True)
            stop.wait()
        finally:
            if service is not None:
                service.stop()
            else:
                runtime.close()
            for sig, previous in previous_handlers.items():
                signal.signal(sig, previous)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Concord: automatic synchronization for explicitly connected local AI data routes")
    commands = parser.add_subparsers(dest="command", required=True)
    init_parser = commands.add_parser("init", help="Create example source data and a local runtime configuration without overwriting")
    init_parser.add_argument("--directory", required=True, help="New or empty deployment directory")
    run_parser = commands.add_parser("run", help="Run a configured loopback API and automatic source observer")
    run_parser.add_argument("--config", required=True, help="Path to runtime.json")
    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            path = initialize(args.directory)
            print(f"Created local runtime configuration: {path}")
            print("Example source data is ready. No credentials were printed; keep the local credential file private.")
        else:
            run(args.config)
        return 0
    except (ConfigurationError, OSError, ValueError) as exc:
        # Only explicitly curated ConfigurationError messages may reach the terminal.
        safe = str(exc) if isinstance(exc, ConfigurationError) else "Runtime could not start; check configuration and local port availability"
        print(f"Concord: {safe}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 0
