from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from base64 import urlsafe_b64decode
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

TOKEN_URLS = (
    "https://oauth.telegram.org/auth/token",
    "https://oauth.telegram.org/token",
)
_MAX_AUTH_AGE = 86_400


def decode_b64_json(encoded: str) -> dict[str, Any] | None:
    padding = "=" * ((4 - (len(encoded) % 4)) % 4)
    try:
        raw = urlsafe_b64decode(encoded + padding)
        data = json.loads(raw)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return data


def decode_id_token(id_token: str) -> dict[str, Any] | None:
    parts = id_token.split(".")
    if len(parts) != 3:
        return None
    return decode_b64_json(parts[1])


def verify_login_hash(data: dict[str, Any]) -> bool:
    if not isinstance(data, dict):
        return False

    received = data.get("hash", "")
    if not received:
        return False

    auth_date = data.get("auth_date")
    if auth_date:
        try:
            if time.time() - int(auth_date) > _MAX_AUTH_AGE:
                return False
        except (TypeError, ValueError):
            return False

    lines = []
    for key, value in sorted(data.items()):
        if key != "hash":
            lines.append(f"{key}={value}")
    check_string = "\n".join(lines)

    bot_token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — cannot verify Telegram login hash.")
        return False

    secret = hashlib.sha256(bot_token.encode()).digest()
    computed = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received)


def _token_attempt(code: str) -> dict[str, Any]:
    mode = getattr(settings, "TELEGRAM_OAUTH_EXCHANGE_MODE", "oauth-client-form").strip().lower()
    redirect_uri = str(settings.TELEGRAM_REDIRECT_URI).strip()
    client_id = str(settings.TELEGRAM_CLIENT_ID).strip()
    client_secret = str(settings.TELEGRAM_CLIENT_SECRET).strip()

    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    headers: dict[str, str] = {}

    if mode == "bot-id-form":
        name = "bot-id-form"
        form["bot_id"] = client_id
        form["bot_secret"] = client_secret
    elif mode == "oauth-basic-auth":
        name = "oauth-basic-auth"
        form["client_id"] = client_id
        basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers["Authorization"] = f"Basic {basic}"
    else:
        if mode != "oauth-client-form":
            logger.warning("Unknown TELEGRAM_OAUTH_EXCHANGE_MODE=%r, using oauth-client-form", mode)
        name = "oauth-client-form"
        form["client_id"] = client_id
        form["client_secret"] = client_secret

    return {"name": name, "form": form, "headers": headers}


def _user_from_token_data(data: dict[str, Any]) -> dict[str, Any] | None:
    if "error" in data:
        msg = data.get("error_description") or data.get("error")
        return {"__error__": str(msg)}

    user = data.get("user")
    if isinstance(user, dict):
        merged = dict(user)
        for key, value in data.items():
            if key != "user":
                merged[key] = value
        return merged

    if data.get("id") or data.get("sub"):
        return data

    id_token = data.get("id_token")
    if not isinstance(id_token, str):
        return None

    claims = decode_id_token(id_token)
    if not claims:
        return None

    return {
        "id": claims.get("id") or claims.get("telegram_id") or claims.get("sub"),
        "first_name": claims.get("first_name") or claims.get("given_name", ""),
        "last_name": claims.get("last_name") or claims.get("family_name", ""),
        "username": claims.get("username") or claims.get("preferred_username", ""),
        "photo_url": claims.get("photo_url") or claims.get("picture", ""),
        "email": claims.get("email", ""),
    }


def _post_token(url: str, attempt: dict[str, Any]) -> tuple[str | None, str, int | None]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        return None, f"blocked non-https url: {url}", None

    payload = urllib.parse.urlencode(attempt["form"]).encode()
    headers = {"Content-Type": "application/x-www-form-urlencoded", **attempt["headers"]}
    req = urllib.request.Request(url, data=payload, method="POST", headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310 — TOKEN_URLS are https-only
            return resp.read().decode(errors="replace"), "", None
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode(errors="replace")
        except Exception:
            body = ""
        return None, body[:240], exc.code
    except Exception as exc:
        return None, str(exc), None


def exchange_code(code: str) -> dict[str, Any]:
    attempt = _token_attempt(code)
    last_error = "unknown token exchange error"

    for url in TOKEN_URLS:
        raw, err_body, status = _post_token(url, attempt)
        if raw is None:
            last_error = f"{attempt['name']} -> HTTP {status}: {err_body}" if status else f"{attempt['name']} network error: {err_body}"
            logger.warning("Telegram token failed [%s] url=%s %s", attempt["name"], url, last_error)

            err_l = err_body.lower()
            if "invalid_grant" in err_l or "invalid_client" in err_l:
                redirect_uri = str(settings.TELEGRAM_REDIRECT_URI).strip()
                return {
                    "__error__": (
                        f"{attempt['name']} invalid_grant/invalid_client. "
                        f"Check TELEGRAM_CLIENT_SECRET and redirect URI: {redirect_uri}"
                    )
                }
            if status in {404, 405, 501}:
                continue
            if status is not None:
                return {"__error__": last_error}
            continue

        try:
            data = json.loads(raw)
        except Exception:
            last_error = f"{attempt['name']} non-JSON response"
            continue

        user_data = _user_from_token_data(data)
        if user_data is None:
            last_error = f"{attempt['name']} unexpected JSON keys: {list(data.keys())[:12]}"
            continue
        if "__error__" in user_data:
            return user_data

        logger.info("Telegram token exchange OK via [%s] url=%s", attempt["name"], url)
        return user_data

    return {"__error__": last_error}
