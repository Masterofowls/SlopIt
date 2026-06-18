from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import DataError
from jwt import PyJWKClient
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.clerk_claims import (
    detect_auth_method,
    enrich_from_clerk_api,
    image_url,
    name_parts,
)
from apps.accounts.user_display import is_clerk_username

if TYPE_CHECKING:
    from rest_framework.request import Request

logger = logging.getLogger(__name__)
User = get_user_model()
_jwks_client: PyJWKClient | None = None
_AVATAR_MAX_LEN = 200


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client

    url = getattr(settings, "CLERK_JWKS_URL", "")
    if not url:
        raise AuthenticationFailed("CLERK_JWKS_URL is not configured.")

    _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=3600)
    return _jwks_client


def _verify_clerk_token(token: str) -> dict[str, Any]:
    client = _get_jwks_client()
    try:
        key = client.get_signing_key_from_jwt(token)
        return jwt.decode(token, key.key, algorithms=["RS256"], options={"verify_exp": True})
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationFailed("Clerk token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationFailed(f"Invalid Clerk token: {exc}") from exc


def _unique_username(base: str) -> str:
    base = (base[:28] or "user").replace(" ", "_").lower()
    username = base
    n = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{n}"
        n += 1
    return username


def _username_base(claims: dict[str, Any], clerk_id: str) -> str:
    username = claims.get("username") or ""
    if username and not is_clerk_username(username):
        return username

    email = claims.get("email") or ""
    if email:
        return email.split("@")[0]

    return clerk_id


def _link_clerk_user(user: Any, clerk_id: str, claims: dict[str, Any]) -> None:
    fields = []
    if user.clerk_id != clerk_id:
        user.clerk_id = clerk_id
        fields.append("clerk_id")

    method = detect_auth_method(claims, has_telegram_id=bool(user.telegram_id))
    if method and user.auth_method != method:
        user.auth_method = method
        fields.append("auth_method")

    if fields:
        user.save(update_fields=fields)


def _sync_profile(user: Any, claims: dict[str, Any]) -> None:
    from apps.accounts.models import Profile

    fields = []
    first, last = name_parts(claims)

    if first and user.first_name != first:
        user.first_name = first
        fields.append("first_name")
    if last and user.last_name != last:
        user.last_name = last
        fields.append("last_name")

    username = claims.get("username") or ""
    if username and not is_clerk_username(username) and user.username != username:
        taken = User.objects.filter(username=username).exclude(pk=user.pk).exists()
        if not taken:
            user.username = username
            fields.append("username")

    method = detect_auth_method(claims, has_telegram_id=bool(getattr(user, "telegram_id", None)))
    if method and user.auth_method != method:
        user.auth_method = method
        fields.append("auth_method")

    if fields:
        user.save(update_fields=fields)

    avatar = image_url(claims)
    if not avatar:
        return

    try:
        Profile.objects.filter(user=user).update(social_avatar_url=avatar)
    except DataError:
        Profile.objects.filter(user=user).update(social_avatar_url=avatar[:_AVATAR_MAX_LEN])


def _find_by_clerk_id(clerk_id: str) -> Any | None:
    try:
        return User.objects.get(clerk_id__iexact=clerk_id)
    except User.DoesNotExist:
        return None


def _find_by_email(email: str) -> Any | None:
    if not email:
        return None
    try:
        return User.objects.get(email=email)
    except User.DoesNotExist:
        return None


def get_or_create_from_clerk(claims: dict[str, Any]) -> Any:
    sub = claims.get("sub", "")
    if not sub:
        raise AuthenticationFailed("Token missing required 'sub' claim.")

    clerk_id = sub.lower()
    claims = enrich_from_clerk_api(sub, claims)
    email = claims.get("email") or ""

    user = _find_by_clerk_id(clerk_id)
    if user is not None:
        if user.clerk_id != clerk_id:
            user.clerk_id = clerk_id
            user.save(update_fields=["clerk_id"])
        _sync_profile(user, claims)
        return user

    user = _find_by_email(email)
    if user is not None:
        _link_clerk_user(user, clerk_id, claims)
        _sync_profile(user, claims)
        return user

    first, last = name_parts(claims)
    if email:
        stored_email = email
    else:
        stored_email = f"clerk_{clerk_id}@no-email.local"

    user, created = User.objects.get_or_create(
        clerk_id=clerk_id,
        defaults={
            "username": _unique_username(_username_base(claims, clerk_id)),
            "email": stored_email,
            "auth_method": detect_auth_method(claims),
            "is_active": True,
            "first_name": first,
            "last_name": last,
        },
    )

    if created:
        logger.info("[clerk_auth] Created user pk=%s clerk_id=%s", user.pk, clerk_id)

    _sync_profile(user, claims)
    return user


class ClerkJWTAuthentication(BaseAuthentication):
    def authenticate(self, request: "Request") -> tuple[Any, dict[str, Any]] | None:
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return None

        token = header[7:]
        if not token or not getattr(settings, "CLERK_JWKS_URL", ""):
            return None

        claims = _verify_clerk_token(token)
        return get_or_create_from_clerk(claims), claims

    def authenticate_header(self, request: "Request") -> str:
        return 'Bearer realm="api"'
