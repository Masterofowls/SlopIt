from __future__ import annotations

import logging
import re
import time
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_GOOGLE = re.compile(r"googleusercontent\.com", re.IGNORECASE)
_GITHUB = re.compile(r"avatars\.githubusercontent\.com", re.IGNORECASE)
_API_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_SECONDS = 300
_PROVIDERS = ("yandex", "github", "google", "telegram")


def _claim_string(claims: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    for row in claims.get("external_accounts") or []:
        if not isinstance(row, dict):
            continue
        for key in keys:
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return ""


def _match_provider(text: str) -> str:
    lowered = text.lower()
    for name in _PROVIDERS:
        if name in lowered:
            return name
    return ""


def name_parts(claims: dict[str, Any]) -> tuple[str, str]:
    first = _claim_string(claims, "first_name", "given_name", "firstName")
    last = _claim_string(claims, "last_name", "family_name", "lastName")
    if first or last:
        return first, last

    full = _claim_string(claims, "name", "real_name", "full_name", "display_name")
    if not full:
        return "", ""

    parts = full.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def image_url(claims: dict[str, Any]) -> str:
    return _claim_string(
        claims,
        "image_url",
        "picture",
        "avatar_url",
        "profile_image_url",
        "photo_url",
        "avatar",
    )


def provider_hint(claims: dict[str, Any]) -> str:
    for key in ("provider", "strategy", "oauth_provider"):
        hit = _match_provider(str(claims.get(key) or ""))
        if hit:
            return hit

    for row in claims.get("external_accounts") or []:
        if not isinstance(row, dict):
            continue
        provider = str(row.get("provider") or row.get("strategy") or "")
        hit = _match_provider(provider)
        if hit:
            return hit

    return ""


def detect_auth_method(claims: dict[str, Any], has_telegram_id: bool = False) -> str:
    if has_telegram_id:
        return "telegram"

    hint = provider_hint(claims)
    if hint:
        return hint

    avatar = image_url(claims)
    if _GITHUB.search(avatar):
        return "github"
    if _GOOGLE.search(avatar):
        return "google"
    return ""


def _api_claims_from_user(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}

    for field in ("image_url", "first_name", "last_name", "username"):
        value = data.get(field)
        if isinstance(value, str) and value:
            out[field] = value

    accounts = data.get("external_accounts") or []
    if accounts:
        out["external_accounts"] = accounts
        for row in accounts:
            if not isinstance(row, dict):
                continue
            provider = str(row.get("provider") or "").lower()
            if provider and "provider" not in out:
                out["provider"] = provider

    primary_id = data.get("primary_email_address_id") or ""
    for row in data.get("email_addresses") or []:
        if not isinstance(row, dict):
            continue
        if row.get("id") != primary_id:
            continue
        addr = row.get("email_address") or ""
        if addr and not addr.endswith("@no-email.local"):
            out["email"] = addr
        break

    return out


def enrich_from_clerk_api(clerk_id: str, claims: dict[str, Any]) -> dict[str, Any]:
    secret = getattr(settings, "CLERK_SECRET_KEY", "")
    if not secret:
        return claims

    cached = _API_CACHE.get(clerk_id)
    if cached and time.monotonic() - cached[0] < _CACHE_SECONDS:
        return {**claims, **cached[1]}

    try:
        import httpx

        resp = httpx.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {secret}"},
            timeout=5.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("[clerk_auth] Clerk API failed for %s: %s", clerk_id, exc)
        return claims

    api_claims = _api_claims_from_user(data)
    _API_CACHE[clerk_id] = (time.monotonic(), api_claims)
    return {**claims, **api_claims}
