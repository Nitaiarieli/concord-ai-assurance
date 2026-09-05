"""Loopback-only operational HTTP API for Concord's registered local runtime.

This server deliberately provides no endpoint to edit authoritative source data.
A source owner changes source data; the polling worker observes it independently.
"""
from __future__ import annotations

import hmac
import json
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

MAX_REQUEST_BYTES = 4096
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_QUERY_CHARS = 512


@dataclass(frozen=True)
class ConsumerCredential:
    token: str
    identity: str
    route: str


@dataclass(frozen=True)
class AccessPolicy:
    operator_token: str
    consumers: tuple[ConsumerCredential, ...]

    def __post_init__(self) -> None:
        tokens = [self.operator_token, *(item.token for item in self.consumers)]
        if len(tokens) != len(set(tokens)):
            raise ValueError("Each runtime credential must be unique")
        if not self.consumers or len(self.consumers) > 32:
            raise ValueError("Between one and 32 consumers must be configured")
        if any(not isinstance(token, str) or not 43 <= len(token) <= 256
               or not token.isascii() or any(c.isspace() for c in token) for token in tokens):
            raise ValueError("Runtime credentials must be at least 43 ASCII characters")
        if any(not item.identity or len(item.identity) > 128
               or item.route not in {"support", "success"} for item in self.consumers):
            raise ValueError("Invalid consumer identity or registered route")

    def is_operator(self, token: str) -> bool:
        return hmac.compare_digest(token, self.operator_token)

    def consumer(self, token: str) -> ConsumerCredential | None:
        selected = None
        for item in self.consumers:
            if hmac.compare_digest(token, item.token):
                selected = item
        return selected


class _LoopbackServer(ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False
    allow_reuse_address = True


class RuntimeService:
    """In-process entry point for HTTP acceptance tests and local CLI deployment."""

    def __init__(self, runtime: Any, policy: AccessPolicy, *, port: int = 8080,
                 poll_interval: float = 2.0, console_html: bytes | None = None):
        if isinstance(port, bool) or not isinstance(port, int) or not 0 <= port <= 65535:
            raise ValueError("Invalid loopback port")
        if not isinstance(poll_interval, (int, float)) or isinstance(poll_interval, bool) \
                or not 1 <= poll_interval <= 3600:
            raise ValueError("Poll interval must be between 1 and 3600 seconds")
        self.runtime = runtime
        self.policy = policy
        self.poll_interval = float(poll_interval)
        self._console = console_html or Path(__file__).with_name("console.html").read_bytes()
        if len(self._console) > MAX_RESPONSE_BYTES:
            raise ValueError("Operational console exceeds size limit")
        self._stop = threading.Event()
        self._runtime_lock = threading.RLock()
        self._meta_lock = threading.Lock()
        self._started = False
        self._stopped = False
        self._last_poll_started: float | None = None
        self._last_poll_completed: float | None = None
        self._last_error: str | None = None
        self._poll_running = False
        self._http = _LoopbackServer(("127.0.0.1", port), self._make_handler())
        self.port = self._http.server_address[1]
        self._poll_thread = threading.Thread(target=self._poll, name="concord-source-poll", daemon=True)
        self._http_thread = threading.Thread(
            target=lambda: self._http.serve_forever(poll_interval=0.1),
            name="concord-local-api", daemon=True)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def start(self) -> RuntimeService:
        if self._started or self._stopped:
            raise RuntimeError("Runtime service cannot be started twice")
        self._started = True
        self._poll_thread.start()
        self._http_thread.start()
        return self

    def stop(self) -> None:
        """Stop in bounded time even if an external source stops responding."""
        if self._stopped:
            return
        self._stopped = True
        self._stop.set()
        if self._started:
            self._http.shutdown()
        self._http.server_close()
        if self._started:
            self._poll_thread.join(timeout=2.0)
            self._http_thread.join(timeout=0.5)
        # Never hang shutdown waiting for a worker that currently owns the core lock.
        # The daemon exits with the CLI; the SQLite journal supports the next startup.
        if not self._poll_thread.is_alive() and self._runtime_lock.acquire(timeout=0.1):
            try:
                self.runtime.close()
            finally:
                self._runtime_lock.release()

    def __enter__(self) -> RuntimeService:
        return self.start()

    def __exit__(self, *_: Any) -> None:
        self.stop()

    def _poll(self) -> None:
        while not self._stop.is_set():
            with self._meta_lock:
                self._last_poll_started = time.time()
                self._poll_running = True
            try:
                with self._runtime_lock:
                    self.runtime.tick()
                error = None
            except Exception:
                # Connector exceptions may contain endpoints or credential details.
                error = "synchronization_failed"
            with self._meta_lock:
                self._last_error = error
                self._last_poll_completed = time.time()
                self._poll_running = False
            self._stop.wait(self.poll_interval)

    def _metadata(self) -> dict[str, Any]:
        with self._meta_lock:
            return {
                "poll_interval_seconds": self.poll_interval,
                "last_poll_started_at": self._last_poll_started,
                "last_poll_completed_at": self._last_poll_completed,
                "last_error": self._last_error,
                "poll_running": self._poll_running,
                "deployment": "single_tenant_loopback",
            }

    def _make_handler(self) -> type[BaseHTTPRequestHandler]:
        service = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            server_version = "ConcordLocal"
            sys_version = ""

            def setup(self) -> None:
                super().setup()
                self.connection.settimeout(3.0)

            def log_message(self, *_: Any) -> None:
                # Never write bearer credentials, queries or source content to stdout.
                return

            def _send(self, code: int, payload: Any, *, html: bool = False) -> None:
                try:
                    body = payload if html else json.dumps(
                        payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")
                    ).encode("utf-8")
                except (TypeError, ValueError):
                    code, body, html = 503, b'{"error":"response_unavailable"}', False
                if len(body) > MAX_RESPONSE_BYTES:
                    code, body, html = 503, b'{"error":"response_size_limit"}', False
                self.send_response(code)
                self.send_header("Content-Type", "text/html; charset=utf-8" if html else "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("X-Frame-Options", "DENY")
                self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
                self.send_header("Connection", "close")
                self.end_headers()
                self.close_connection = True
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError, TimeoutError):
                    pass

            def _preflight(self) -> str | None:
                host_headers = self.headers.get_all("Host", [])
                allowed = {f"localhost:{service.port}", f"127.0.0.1:{service.port}"}
                if service.port == 80:
                    allowed.update({"localhost", "127.0.0.1"})
                if len(host_headers) != 1 or host_headers[0] not in allowed:
                    self._send(403, {"error": "host_not_allowed"})
                    return None
                origins = self.headers.get_all("Origin", [])
                if len(origins) > 1 or (origins and origins[0] != f"http://{host_headers[0]}"):
                    self._send(403, {"error": "origin_not_allowed"})
                    return None
                # Query-string credentials are unsupported, including on health or console.
                try:
                    parsed = urlsplit(self.path)
                except ValueError:
                    self._send(400, {"error": "invalid_request_target"})
                    return None
                if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
                    self._send(400, {"error": "query_parameters_not_supported"})
                    return None
                return parsed.path

            def _token(self) -> str | None:
                headers = self.headers.get_all("Authorization", [])
                if len(headers) != 1 or not headers[0].startswith("Bearer "):
                    self._send(401, {"error": "authentication_required"})
                    return None
                token = headers[0][7:]
                if not 43 <= len(token) <= 256 or not token.isascii():
                    self._send(401, {"error": "invalid_credential"})
                    return None
                return token

            def do_GET(self) -> None:
                path = self._preflight()
                if path is None:
                    return
                if path == "/healthz":
                    self._send(200, {"status": "ok"})
                    return
                if path == "/":
                    self._send(200, service._console, html=True)
                    return
                if path != "/v1/status":
                    self._send(404, {"error": "not_found"})
                    return
                token = self._token()
                if token is None:
                    return
                if not service.policy.is_operator(token):
                    self._send(403, {"error": "operator_credential_required"})
                    return
                if not service._runtime_lock.acquire(timeout=0.25):
                    self._send(503, {"error": "sync_busy", "runtime": service._metadata()})
                    return
                try:
                    result = service.runtime.status()
                    self._send(200, {"runtime": service._metadata(), "sync": result})
                except Exception:
                    self._send(503, {"error": "status_unavailable"})
                finally:
                    service._runtime_lock.release()

            def do_POST(self) -> None:
                path = self._preflight()
                if path is None:
                    return
                if path != "/v1/retrieve":
                    self._send(404, {"error": "not_found"})
                    return
                token = self._token()
                if token is None:
                    return
                consumer = service.policy.consumer(token)
                if consumer is None:
                    self._send(403, {"error": "consumer_credential_required"})
                    return
                lengths = self.headers.get_all("Content-Length", [])
                if self.headers.get("Transfer-Encoding") or len(lengths) != 1:
                    self._send(411, {"error": "content_length_required"})
                    return
                try:
                    length = int(lengths[0])
                except ValueError:
                    self._send(400, {"error": "invalid_content_length"})
                    return
                if not 1 <= length <= MAX_REQUEST_BYTES:
                    self._send(413, {"error": "request_size_limit"})
                    return
                if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
                    self._send(415, {"error": "application_json_required"})
                    return
                try:
                    body = self.rfile.read(length)
                    if len(body) != length:
                        raise ValueError("Incomplete request")
                    obj = json.loads(body)
                    if not isinstance(obj, dict) or set(obj) != {"query"}:
                        raise ValueError("Only query is accepted")
                    query = obj["query"]
                    if not isinstance(query, str) or not 1 <= len(query.strip()) <= MAX_QUERY_CHARS:
                        raise ValueError("Invalid query")
                except (ValueError, UnicodeDecodeError, TimeoutError, OSError, RecursionError):
                    self._send(400, {"error": "invalid_retrieval_request"})
                    return
                if not service._runtime_lock.acquire(timeout=0.25):
                    self._send(503, {"error": "sync_busy", "runtime": service._metadata()})
                    return
                try:
                    result = service.runtime.retrieve(
                        query=query.strip(), identity=consumer.identity, route=consumer.route)
                    self._send(200, result)
                except Exception:
                    self._send(503, {"error": "retrieval_unavailable"})
                finally:
                    service._runtime_lock.release()

            def do_OPTIONS(self) -> None:
                if self._preflight() is not None:
                    self._send(405, {"error": "method_not_allowed"})

            def do_PUT(self) -> None:
                self.do_OPTIONS()

            def do_DELETE(self) -> None:
                self.do_OPTIONS()

        return Handler
