"""Telegram OIDC / Login-Widget authentication views.

Two flows are handled at the same callback URL:

1. **New OIDC flow** (BotFather Client ID + Client Secret):
   GET /accounts/telegram/login/
     -> redirects to https://oauth.telegram.org/auth?...
   GET /accounts/telegram/login/callback/?code=...&state=...
     -> exchanges code at https://oauth.telegram.org/auth/token
     -> creates/links Django User by telegram_id
     -> sets Django session, redirects to FRONTEND_URL

2. **Legacy Login Widget** (inline JS widget, sends hash params):
   GET /accounts/telegram/login/callback/?id=...&hash=...
     -> verifies HMAC-SHA256 against bot token
     -> creates/links Django User by telegram_id
     -> sets Django session, redirects to FRONTEND_URL

Both flows coexist with Clerk JWT auth -- Clerk users send
``Authorization: Bearer <token>`` on API calls while Telegram users
rely on the Django session cookie (``SessionAuthentication`` in DRF).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import urllib.error
import urllib.parse
import urllib.request
from base64 import urlsafe_b64decode
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.http import (
    HttpRequest,
    HttpResponseBadRequest,
    HttpResponseRedirect,
    HttpResponseServerError,
)
from django.views.decorators.http import require_GET

logger = logging.getLogger(__name__)
User = get_user_model()

# Telegram OIDC endpoints
_AUTH_URL = "https://oauth.telegram.org/auth"
_TOKEN_URLS = [
    "https://oauth.telegram.org/auth/token",
    "https://oauth.telegram.org/token",
]

# How many seconds old a login hash can be (legacy widget)
_MAX_AUTH_AGE = 86_400  # 24 h


# --- Login initiation ---------------------------------------------------------


@require_GET
def telegram_login_redirect(request: HttpRequest) -> HttpResponseRedirect:
    """GET /accounts/telegram/login/ -> redirect to Telegram OAuth2."""
    state = secrets.token_urlsafe(32)
    request.session["telegram_oauth_state"] = state
    # Keep frontend return location in session so callback can redirect like Clerk.
    request.session["telegram_oauth_next"] = _normalize_next_path(request.GET.get("next", "/home"))

    params = urllib.parse.urlencode(
        {
            "client_id": settings.TELEGRAM_CLIENT_ID,
            "redirect_uri": settings.TELEGRAM_REDIRECT_URI,
            "response_type": "code",
            "state": state,
        }
    )
    return HttpResponseRedirect(f"{_AUTH_URL}?{params}")


# --- Callback -----------------------------------------------------------------


@require_GET
def telegram_callback(
    request: HttpRequest,
) -> HttpResponseRedirect | HttpResponseBadRequest | HttpResponseServerError:
    """GET /accounts/telegram/login/callback/ -- unified callback handler."""

    code = request.GET.get("code", "")
    tg_result = request.GET.get("tgAuthResult", "")
    tg_id = request.GET.get("id", "")

    try:
        if code:
            logger.info(
                "Telegram OIDC callback: params=%s",
                list(request.GET.keys()),
            )
            # New OIDC code flow
            state = request.GET.get("state", "")
            expected = request.session.pop("telegram_oauth_state", None)
            if not state or state != expected:
                return HttpResponseBadRequest("Invalid OAuth state.")
            user_data = _exchange_code(code)
            if user_data is None:
                return HttpResponseBadRequest("Failed to exchange Telegram auth code.")
            if "__error__" in user_data:
                logger.error("Telegram code exchange error: %s", user_data["__error__"])
                return HttpResponseBadRequest(f"Telegram auth failed: {user_data['__error__']}")

        elif tg_result:
            # tgAuthResult (base64 JSON from new widget)
            user_data = _decode_tg_auth_result(tg_result)
            if user_data is None:
                return HttpResponseBadRequest("Invalid tgAuthResult.")

        elif tg_id:
            # Legacy Login Widget (plain query params + hash)
            user_data = dict(request.GET.items())
            if not _verify_legacy_hash(user_data):
                return HttpResponseBadRequest("Invalid Telegram login hash.")

        else:
            return HttpResponseBadRequest("No Telegram auth data in callback.")

        django_user = _get_or_create_user(user_data)
        login(request, django_user, backend="django.contrib.auth.backends.ModelBackend")
        logger.info(
            "Telegram login: user pk=%s telegram_id=%s",
            django_user.pk,
            django_user.telegram_id,
        )
        return HttpResponseRedirect(_frontend_redirect_url(request))

    except Exception as exc:
        logger.exception("Telegram callback error: %s", exc)
        return HttpResponseServerError("An error occurred during Telegram authentication.")


# --- OIDC code exchange -------------------------------------------------------


def _exchange_code(code: str) -> dict[str, Any] | None:
    """Exchange an auth code with Telegram.

    Telegram auth has multiple variants in the wild, so we try a small set of
    endpoint/payload formats before failing. This avoids hard-failing if the
    account was configured with a slightly different token contract.
    """

    exchange_mode = (
        getattr(settings, "TELEGRAM_OAUTH_EXCHANGE_MODE", "oauth-client-form").strip().lower()
    )
    redirect_uri = str(settings.TELEGRAM_REDIRECT_URI).strip()
    client_id = str(settings.TELEGRAM_CLIENT_ID).strip()
    client_secret = str(settings.TELEGRAM_CLIENT_SECRET).strip()

    attempts_by_mode = {
        "oauth-client-form": {
            "name": "oauth-client-form",
            "form": {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            "headers": {},
        },
        "bot-id-form": {
            "name": "bot-id-form",
            "form": {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "bot_id": client_id,
                "bot_secret": client_secret,
            },
            "headers": {},
        },
        "oauth-basic-auth": {
            "name": "oauth-basic-auth",
            "form": {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
            },
            "headers": {
                "Authorization": "Basic "
                + base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
            },
        },
    }

    if exchange_mode not in attempts_by_mode:
        logger.warning(
            "Unknown TELEGRAM_OAUTH_EXCHANGE_MODE=%r, defaulting to oauth-client-form",
            exchange_mode,
        )
        exchange_mode = "oauth-client-form"

    attempt = attempts_by_mode[exchange_mode]
    last_error = "unknown token exchange error"

    for token_url in _TOKEN_URLS:
        payload = urllib.parse.urlencode(attempt["form"]).encode()
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            **attempt["headers"],
        }
        req = urllib.request.Request(  # noqa: S310
            token_url,
            data=payload,
            method="POST",
            headers=headers,
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
                raw = resp.read().decode(errors="replace")
        except urllib.error.HTTPError as exc:
            try:
                body = exc.read().decode(errors="replace")
            except Exception:
                body = "(no body)"

            body_l = body.lower()
            last_error = f"{attempt['name']} -> HTTP {exc.code}: {body[:240]}"
            logger.warning(
                "Telegram token exchange failed [%s] url=%s status=%s body=%s",
                attempt["name"],
                token_url,
                exc.code,
                body[:500],
            )

            # Avoid retrying the same one-time code when grant/client is invalid.
            if "invalid_grant" in body_l or "invalid_client" in body_l:
                return {
                    "__error__": (
                        f"{attempt['name']} invalid_grant/invalid_client. "
                        f"Verify TELEGRAM_CLIENT_SECRET and exact redirect URI match: {redirect_uri}"
                    )
                }

            # Only try next token endpoint if this endpoint is missing/unsupported.
            if exc.code in {404, 405, 501}:
                continue
            return {"__error__": last_error}
        except Exception as exc:
            last_error = f"{attempt['name']} network error: {exc}"
            logger.warning(
                "Telegram token exchange network error [%s] url=%s err=%s",
                attempt["name"],
                token_url,
                exc,
            )
            continue

        try:
            data: dict[str, Any] = json.loads(raw)
        except Exception:
            last_error = f"{attempt['name']} non-JSON response from {token_url}: {raw[:240]}"
            logger.warning(last_error)
            continue

        # Surface Telegram's own error field if present.
        if "error" in data:
            description = data.get("error_description") or data.get("error")
            last_error = f"{attempt['name']} {description}"
            logger.warning("Telegram token error [%s]: %s", attempt["name"], description)
            return {"__error__": last_error}

        # Telegram may nest user info under "user" key.
        if "user" in data and isinstance(data["user"], dict):
            merged = {**data["user"], **{k: v for k, v in data.items() if k != "user"}}
            logger.info(
                "Telegram token exchange succeeded via [%s] url=%s",
                attempt["name"],
                token_url,
            )
            return merged

        # Some variants return user fields flat.
        if data.get("id") or data.get("sub"):
            logger.info(
                "Telegram token exchange succeeded (flat payload) via [%s] url=%s",
                attempt["name"],
                token_url,
            )
            return data

        # Standard OIDC token response: decode claims from id_token.
        if isinstance(data.get("id_token"), str):
            claims = _decode_id_token_claims(data["id_token"])
            if claims:
                mapped = {
                    **claims,
                    "id": claims.get("id") or claims.get("telegram_id") or claims.get("sub"),
                    "first_name": claims.get("first_name") or claims.get("given_name", ""),
                    "last_name": claims.get("last_name") or claims.get("family_name", ""),
                    "username": claims.get("username") or claims.get("preferred_username", ""),
                    "photo_url": claims.get("photo_url") or claims.get("picture", ""),
                    "email": claims.get("email", ""),
                }
                logger.info(
                    "Telegram token exchange succeeded via id_token claims [%s] url=%s keys=%s",
                    attempt["name"],
                    token_url,
                    list(claims.keys())[:12],
                )
                return mapped

        last_error = f"{attempt['name']} unexpected JSON keys: {list(data.keys())[:12]}"
        logger.warning(last_error)

    return {"__error__": last_error}


def _decode_id_token_claims(id_token: str) -> dict[str, Any] | None:
    """Decode JWT payload claims from id_token without signature validation.

    This token is obtained server-to-server from Telegram's token endpoint over
    HTTPS after a successful authorization-code exchange.
    """
    parts = id_token.split(".")
    if len(parts) != 3:
        return None
    payload_part = parts[1]
    padding = "=" * ((4 - (len(payload_part) % 4)) % 4)
    try:
        payload_bytes = urlsafe_b64decode(payload_part + padding)
        claims = json.loads(payload_bytes)
    except Exception:
        return None
    if not isinstance(claims, dict):
        return None
    return claims


def _normalize_next_path(next_path: str | None) -> str:
    """Allow only relative app paths to avoid open redirects."""
    value = (next_path or "/home").strip()
    if not value.startswith("/"):
        return "/home"
    if value.startswith("//"):
        return "/home"
    return value


def _frontend_redirect_url(request: HttpRequest) -> str:
    """Build final frontend redirect URL after successful Telegram auth."""
    base = str(getattr(settings, "FRONTEND_URL", "")).rstrip("/")
    next_path = _normalize_next_path(request.session.pop("telegram_oauth_next", "/home"))
    if not base:
        return next_path

    parsed = urllib.parse.urlparse(base)
    if parsed.scheme and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}"
        configured_path = (parsed.path or "").rstrip("/")

        # If FRONTEND_URL already includes the same path (e.g. /home),
        # avoid duplicating it as /home/home.
        if configured_path and configured_path == next_path:
            return f"{origin}{configured_path}"
        return f"{origin}{next_path}"

    return f"{base}{next_path}"


# --- tgAuthResult decoder -----------------------------------------------------


def _decode_tg_auth_result(encoded: str) -> dict[str, Any] | None:
    """Decode and verify a base64url-encoded tgAuthResult blob."""
    try:
        # Pad to a multiple of 4 before decoding
        padding = 4 - len(encoded) % 4
        data: dict = json.loads(urlsafe_b64decode(encoded + "=" * padding))
    except Exception:
        return None

    if not _verify_legacy_hash(data):
        return None
    return data


# --- Legacy hash verification --------------------------------------------------


def _verify_legacy_hash(data: dict[str, Any]) -> bool:
    """Verify the HMAC-SHA256 hash from the Telegram Login Widget.

    See https://core.telegram.org/widgets/login#checking-authorization
    """
    import time

    received_hash = data.pop("hash", "") if isinstance(data, dict) else ""
    if not received_hash:
        return False

    # Optionally check freshness (skip in tests where auth_date may be absent)
    auth_date = data.get("auth_date")
    if auth_date:
        try:
            if time.time() - int(auth_date) > _MAX_AUTH_AGE:
                return False
        except (TypeError, ValueError):
            return False

    check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if k != "hash")
    bot_token: str = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set -- cannot verify Telegram login hash.")
        return False

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hash)


# --- User creation / linking --------------------------------------------------


def _get_or_create_user(data: dict[str, Any]) -> Any:
    """Map Telegram user data to a Django User, creating one if needed."""
    telegram_id = str(data.get("id") or data.get("sub") or "").strip()
    if not telegram_id:
        raise ValueError(f"No Telegram user ID found in data: {list(data.keys())}")

    # 1. Fast path -- already linked.
    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        pass

    email: str = data.get("email", "") or ""

    # 2. Adopt an existing account by email (Clerk / password users).
    if email:
        try:
            user = User.objects.get(email=email)
            user.telegram_id = telegram_id
            user.save(update_fields=["telegram_id"])
            logger.info(
                "Linked Telegram ID %s to existing user pk=%s via email",
                telegram_id,
                user.pk,
            )
            return user
        except User.DoesNotExist:
            pass

    # 3. Create a new Django user.
    base = data.get("username") or f"tg_{telegram_id}"
    username = base
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}_{counter}"
        counter += 1

    first = data.get("first_name", "")
    last = data.get("last_name", "")
    user = User.objects.create(
        username=username,
        email=email or f"tg_{telegram_id}@telegram.placeholder",
        first_name=first,
        last_name=last,
        telegram_id=telegram_id,
        is_active=True,
    )

    photo_url: str = data.get("photo_url", "") or ""
    if photo_url:
        from apps.accounts.models import Profile

        Profile.objects.filter(user=user).update(social_avatar_url=photo_url)

    logger.info("Created Django user pk=%s for Telegram ID %s", user.pk, telegram_id)
    return user
