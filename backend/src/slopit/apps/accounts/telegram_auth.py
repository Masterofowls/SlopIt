from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time
import urllib.parse
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

from apps.accounts.telegram_oauth import exchange_code

logger = logging.getLogger(__name__)
User = get_user_model()

_AUTH_URL = "https://oauth.telegram.org/auth"
_MAX_AUTH_AGE = 86_400


@require_GET
def telegram_login_redirect(request: HttpRequest) -> HttpResponseRedirect:
    state = secrets.token_urlsafe(32)
    request.session["telegram_oauth_state"] = state
    request.session["telegram_oauth_next"] = _normalize_next_path(request.GET.get("next", "/home"))

    params = urllib.parse.urlencode({
        "client_id": settings.TELEGRAM_CLIENT_ID,
        "redirect_uri": settings.TELEGRAM_REDIRECT_URI,
        "response_type": "code",
        "state": state,
    })
    return HttpResponseRedirect(f"{_AUTH_URL}?{params}")


@require_GET
def telegram_callback(
    request: HttpRequest,
) -> HttpResponseRedirect | HttpResponseBadRequest | HttpResponseServerError:
    try:
        user_data = _parse_callback(request)
        if user_data is None:
            return HttpResponseBadRequest("Invalid Telegram auth data.")
        if "__error__" in user_data:
            return HttpResponseBadRequest(f"Telegram auth failed: {user_data['__error__']}")

        django_user = _get_or_create_user(user_data)
        login(request, django_user, backend="django.contrib.auth.backends.ModelBackend")
        logger.info("Telegram login: user pk=%s telegram_id=%s", django_user.pk, django_user.telegram_id)
        return HttpResponseRedirect(_frontend_redirect_url(request))
    except Exception as exc:
        logger.exception("Telegram callback error: %s", exc)
        return HttpResponseServerError("An error occurred during Telegram authentication.")


def _parse_callback(request: HttpRequest) -> dict[str, Any] | None:
    code = request.GET.get("code", "")
    tg_result = request.GET.get("tgAuthResult", "")
    tg_id = request.GET.get("id", "")

    if code:
        state = request.GET.get("state", "")
        expected = request.session.pop("telegram_oauth_state", None)
        if not state or state != expected:
            return None
        return exchange_code(code)

    if tg_result:
        return _decode_tg_auth_result(tg_result)

    if tg_id:
        user_data = dict(request.GET.items())
        if _verify_legacy_hash(user_data):
            return user_data

    return None


def _decode_tg_auth_result(encoded: str) -> dict[str, Any] | None:
    try:
        padding = "=" * ((4 - (len(encoded) % 4)) % 4)
        data = json.loads(urlsafe_b64decode(encoded + padding))
    except Exception:
        return None
    if not _verify_legacy_hash(data):
        return None
    return data


def _verify_legacy_hash(data: dict[str, Any]) -> bool:
    if not isinstance(data, dict):
        return False

    received_hash = data.get("hash", "")
    if not received_hash:
        return False

    auth_date = data.get("auth_date")
    if auth_date:
        try:
            if time.time() - int(auth_date) > _MAX_AUTH_AGE:
                return False
        except (TypeError, ValueError):
            return False

    check_items = []
    for key, value in sorted(data.items()):
        if key != "hash":
            check_items.append(f"{key}={value}")
    check_string = "\n".join(check_items)

    bot_token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — cannot verify Telegram login hash.")
        return False

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, received_hash)


def _normalize_next_path(next_path: str | None) -> str:
    value = (next_path or "/home").strip()
    if not value.startswith("/"):
        return "/home"
    if value.startswith("//"):
        return "/home"
    return value


def _frontend_redirect_url(request: HttpRequest) -> str:
    base = str(getattr(settings, "FRONTEND_URL", "")).rstrip("/")
    next_path = _normalize_next_path(request.session.pop("telegram_oauth_next", "/home"))
    if not base:
        return next_path

    parsed = urllib.parse.urlparse(base)
    if parsed.scheme and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}"
        configured_path = (parsed.path or "").rstrip("/")
        if configured_path and configured_path == next_path:
            return f"{origin}{configured_path}"
        return f"{origin}{next_path}"

    return f"{base}{next_path}"


def _get_or_create_user(data: dict[str, Any]) -> Any:
    telegram_id = str(data.get("id") or data.get("sub") or "").strip()
    if not telegram_id:
        raise ValueError(f"No Telegram user ID found in data: {list(data.keys())}")

    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        pass

    email = data.get("email", "") or ""
    if email:
        try:
            user = User.objects.get(email=email)
            user.telegram_id = telegram_id
            user.save(update_fields=["telegram_id"])
            return user
        except User.DoesNotExist:
            pass

    base = data.get("username") or f"tg_{telegram_id}"
    username = base
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}_{counter}"
        counter += 1

    if email:
        email_to_store = email
    else:
        email_to_store = f"tg_{telegram_id}@telegram.placeholder"

    user = User.objects.create(
        username=username,
        email=email_to_store,
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        telegram_id=telegram_id,
        is_active=True,
    )

    photo_url = data.get("photo_url", "") or ""
    if photo_url:
        from apps.accounts.models import Profile
        Profile.objects.filter(user=user).update(social_avatar_url=photo_url)

    logger.info("Created Django user pk=%s for Telegram ID %s", user.pk, telegram_id)
    return user
