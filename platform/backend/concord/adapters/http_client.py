"""Small, injectable JSON transport; credentials are never included in errors."""
import json
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

class AdapterError(RuntimeError):
    pass

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class JsonTransport:
    def __init__(self, base_url: str, headers: dict | None = None, timeout: int = 10):
        parsed = urlsplit(base_url)
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Use a base URL without credentials, query, or fragment")
        if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in {'localhost','127.0.0.1','::1'}):
            raise ValueError("HTTPS is required outside loopback")
        if not parsed.hostname:
            raise ValueError("A host is required")
        self.base_url = base_url.rstrip('/')
        self.headers = headers or {}
        self.timeout = timeout

    def request(self, method: str, path: str, payload: dict | None = None) -> dict:
        if not path.startswith('/') or path.startswith('//'):
            raise ValueError("Relative API path required")
        body = json.dumps(payload).encode() if payload is not None else None
        request = Request(self.base_url + path, data=body, method=method,
                          headers={**self.headers, 'Accept':'application/json', 'Content-Type':'application/json'})
        try:
            with build_opener(NoRedirect()).open(request, timeout=self.timeout) as response:
                raw = response.read(4 * 1024 * 1024 + 1)
                if len(raw) > 4 * 1024 * 1024:
                    raise AdapterError("Provider response exceeds the configured limit")
                return json.loads(raw) if raw else {}
        except HTTPError as error:
            raise AdapterError(f"Provider returned HTTP {error.code}; authorization and existence remain unverified") from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise AdapterError("Provider request failed; no verification result is available") from None
