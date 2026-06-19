from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse


def _validate_https_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Only https URLs are allowed, got: {parsed.scheme!r}")
    if not parsed.netloc:
        raise ValueError(f"Invalid URL: {url!r}")
    return url


def fetch_bytes(url: str, *, timeout: int = 30, headers: dict[str, str] | None = None) -> bytes:
    safe_url = _validate_https_url(url)
    req_headers = headers or {}
    req = urllib.request.Request(safe_url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec B310 — https-only after _validate_https_url
        return resp.read()


def fetch_json(url: str, *, timeout: int = 5) -> dict[str, Any]:
    raw = fetch_bytes(url, timeout=timeout)
    data = json.loads(raw.decode())
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object response")
    return data
