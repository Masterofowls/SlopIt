"""Clerk JWT authentication for Django REST Framework.

The frontend (using @clerk/clerk-react or similar) sends the Clerk session
token as ``Authorization: Bearer <token>`` on every API request.

This module:
1. Validates the token against Clerk's JWKS endpoint.
2. Looks up the Django User by ``clerk_id`` (the JWT ``sub`` claim).
3. Creates a new Django User if one doesn't exist yet, or links an existing
   allauth-created user by email so legacy accounts carry over seamlessly.

Required Fly secret::

    flyctl secrets set CLERK_JWKS_URL=https://<clerk-domain>/.well-known/jwks.json

If ``CLERK_JWKS_URL`` is not set (local dev without Clerk), this authenticator
is skipped and Django falls back to session auth.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from jwt import PyJWKClient
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

if TYPE_CHECKING:
    from rest_framework.request import Request

logger = logging.getLogger(__name__)
User = get_user_model()

# Module-level JWKS client — shared across requests, caches signing keys.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url: str = getattr(settings, "CLERK_JWKS_URL", "")
        if not url:
            raise AuthenticationFailed("CLERK_JWKS_URL is not configured.")
        # cache_keys=True keeps signing keys in memory; lifespan refreshes hourly.
        _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=3600)
    return _jwks_client


def _verify_clerk_token(token: str) -> dict[str, Any]:
    """Validate a Clerk JWT and return its decoded claims."""
    client = _get_jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationFailed("Clerk token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationFailed(f"Invalid Clerk token: {exc}") from exc


def _derive_unique_username(base: str) -> str:
    """Return a unique Django username derived from *base*."""
    base = (base[:28] or "user").replace(" ", "_").lower()
    username, counter = base, 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{counter}"
        counter += 1
    return username


def get_or_create_from_clerk(claims: dict[str, Any]) -> Any:
    """Map a verified Clerk JWT payload to a Django ``User``.

    Resolution order:
    1. Look up by ``clerk_id`` — fastest path after first login.
    2. Look up by email — links legacy allauth-created users on first Clerk login.
    3. Create a new ``User`` record.
    """
    clerk_id: str = claims.get("sub", "")
    if not clerk_id:
        raise AuthenticationFailed("Token missing required 'sub' claim.")

    # 1. Fast path — already linked.
    try:
        return User.objects.get(clerk_id=clerk_id)
    except User.DoesNotExist:
        pass

    email: str = claims.get("email", "")

    # 2. Adopt an existing account by email (allauth / email-password users).
    if email:
        try:
            user = User.objects.get(email=email)
            user.clerk_id = clerk_id
            user.save(update_fields=["clerk_id"])
            logger.info(
                "Linked Clerk ID %s to existing user pk=%s via email", clerk_id, user.pk
            )
            return user
        except User.DoesNotExist:
            pass

    # 3. Create a brand-new Django user.
    base = claims.get("username") or (email.split("@")[0] if email else clerk_id)
    username = _derive_unique_username(base)
    user = User.objects.create(
        username=username,
        email=email,
        clerk_id=clerk_id,
        is_active=True,
    )

    # Sync avatar from Clerk's image_url claim (if present).
    image_url: str = claims.get("image_url", "")
    if image_url:
        from apps.accounts.models import Profile

        Profile.objects.filter(user=user).update(social_avatar_url=image_url)

    logger.info("Created Django user pk=%s for Clerk ID %s", user.pk, clerk_id)
    return user


class ClerkJWTAuthentication(BaseAuthentication):
    """DRF authentication backend: verify Clerk Bearer tokens.

    Attach to ``REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]`` before
    ``SessionAuthentication`` so API requests authenticated with Clerk tokens
    take precedence over browser sessions.
    """

    def authenticate(self, request: "Request") -> tuple[Any, dict[str, Any]] | None:
        auth_header: str = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        if not token:
            return None

        # Graceful no-op when Clerk is not configured (local dev / CI).
        if not getattr(settings, "CLERK_JWKS_URL", ""):
            return None

        claims = _verify_clerk_token(token)
        user = get_or_create_from_clerk(claims)
        return (user, claims)

    def authenticate_header(self, request: "Request") -> str:
        return 'Bearer realm="api"'
