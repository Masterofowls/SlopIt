from __future__ import annotations

import logging
import secrets
import urllib.parse
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

from apps.accounts.telegram_oauth import (
    decode_b64_json,
    exchange_code,
    verify_login_hash,
)

logger = logging.getLogger(__name__)
User = get_user_model()
_AUTH_URL = "https://oauth.telegram.org/auth"


@require_GET
def telegram_login_redirect(request: HttpRequest) -> HttpResponseRedirect:
    state = secrets.token_urlsafe(32)
    request.session["telegram_oauth_state"] = state
    request.session["telegram_oauth_next"] = _safe_next_path(request.GET.get("next", "/home"))

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
        user_data = _read_callback_data(request)
        if user_data is None:
            return HttpResponseBadRequest("Invalid Telegram auth data.")
        if "__error__" in user_data:
            return HttpResponseBadRequest(f"Telegram auth failed: {user_data['__error__']}")

        user = _get_or_create_user(user_data)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        logger.info("Telegram login: user pk=%s telegram_id=%s", user.pk, user.telegram_id)
        return HttpResponseRedirect(_redirect_after_login(request))
    except Exception as exc:
        logger.exception("Telegram callback error: %s", exc)
        return HttpResponseServerError("An error occurred during Telegram authentication.")


def _read_callback_data(request: HttpRequest) -> dict[str, Any] | None:
    code = request.GET.get("code", "")
    if code:
        state = request.GET.get("state", "")
        expected = request.session.pop("telegram_oauth_state", None)
        if not state or state != expected:
            return None
        return exchange_code(code)

    tg_result = request.GET.get("tgAuthResult", "")
    if tg_result:
        data = decode_b64_json(tg_result)
        if data and verify_login_hash(data):
            return data
        return None

    tg_id = request.GET.get("id", "")
    if tg_id:
        data = dict(request.GET.items())
        if verify_login_hash(data):
            return data

    return None


def _safe_next_path(next_path: str | None) -> str:
    value = (next_path or "/home").strip()
    if not value.startswith("/") or value.startswith("//"):
        return "/home"
    return value


def _redirect_after_login(request: HttpRequest) -> str:
    next_path = _safe_next_path(request.session.pop("telegram_oauth_next", "/home"))
    base = str(getattr(settings, "FRONTEND_URL", "")).rstrip("/")
    if not base:
        return next_path

    parsed = urllib.parse.urlparse(base)
    if not parsed.scheme or not parsed.netloc:
        return f"{base}{next_path}"

    origin = f"{parsed.scheme}://{parsed.netloc}"
    configured = (parsed.path or "").rstrip("/")
    if configured and configured == next_path:
        return f"{origin}{configured}"
    return f"{origin}{next_path}"


def _telegram_id(data: dict[str, Any]) -> str:
    return str(data.get("id") or data.get("sub") or "").strip()


def _find_by_telegram_id(telegram_id: str) -> Any | None:
    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        return None


def _find_by_email(email: str) -> Any | None:
    if not email:
        return None
    try:
        return User.objects.get(email=email)
    except User.DoesNotExist:
        return None


def _unique_username(base: str) -> str:
    username = base
    n = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}_{n}"
        n += 1
    return username


def _link_telegram(user: Any, telegram_id: str) -> None:
    if user.telegram_id != telegram_id:
        user.telegram_id = telegram_id
        user.save(update_fields=["telegram_id"])


def _save_avatar(user: Any, photo_url: str) -> None:
    if not photo_url:
        return
    from apps.accounts.models import Profile
    Profile.objects.filter(user=user).update(social_avatar_url=photo_url)


def _get_or_create_user(data: dict[str, Any]) -> Any:
    telegram_id = _telegram_id(data)
    if not telegram_id:
        raise ValueError(f"No Telegram user ID found in data: {list(data.keys())}")

    user = _find_by_telegram_id(telegram_id)
    if user is not None:
        return user

    email = data.get("email") or ""
    user = _find_by_email(email)
    if user is not None:
        _link_telegram(user, telegram_id)
        return user

    base = data.get("username") or f"tg_{telegram_id}"
    if email:
        stored_email = email
    else:
        stored_email = f"tg_{telegram_id}@telegram.placeholder"

    user = User.objects.create(
        username=_unique_username(base),
        email=stored_email,
        first_name=data.get("first_name", ""),
        last_name=data.get("last_name", ""),
        telegram_id=telegram_id,
        is_active=True,
    )

    _save_avatar(user, data.get("photo_url") or "")
    logger.info("Created Django user pk=%s for Telegram ID %s", user.pk, telegram_id)
    return user
