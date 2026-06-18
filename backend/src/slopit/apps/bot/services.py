from __future__ import annotations

from apps.accounts.safe_http import fetch_json

__all__ = ["fetch_api_status"]


def fetch_api_status(status_url: str, timeout_seconds: int = 5) -> dict:
    return fetch_json(status_url, timeout=timeout_seconds)
