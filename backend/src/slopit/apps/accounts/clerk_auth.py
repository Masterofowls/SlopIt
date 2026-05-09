"""Clerk JWT authentication for Django REST Framework.

The frontend (using @clerk/clerk-react or similar) sends the Clerk session
token as ``Authorization: Bearer <token>`` on every API request.

This module:
1. Validates the token against Clerk's JWKS endpoint.
2. Looks up the Django User by ``clerk_id`` (the JWT ``sub`` claim).
3. Creates a new Django User if one doesn't exist yet, or links an existing
   allauth-created user by email so legacy accounts carry over seamlessly.
4. Auto-detects and persists the OAuth provider (google / github / telegram)
   as ``User.auth_method`` on every successful authentication.

Required Fly secret::

    flyctl secrets set CLERK_JWKS_URL=https://<clerk-domain>/.well-known/jwks.json

If ``CLERK_JWKS_URL`` is not set (local dev without Clerk), this authenticator
is skipped and Django falls back to session auth.

Debug logging
-------------
Set the ``accounts.clerk_auth`` logger to DEBUG to see full structured traces
of every auth attempt, including detected provider and any error context.
"""

from __future__ import annotations

import logging
import re
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

# Image-URL patterns used to identify the OAuth provider from the Clerk JWT.
_GOOGLE_PATTERN = re.compile(r"googleusercontent\.com", re.IGNORECASE)
_GITHUB_PATTERN = re.compile(r"avatars\.githubusercontent\.com", re.IGNORECASE)


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
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
        logger.debug(
            "[clerk_auth] Token verified. sub=%s email=%r image_url=%r",
            claims.get("sub"),
            claims.get("email"),
            claims.get("image_url"),
        )
        return claims
    except jwt.ExpiredSignatureError as exc:
        logger.warning(
            "[clerk_auth] Token expired. error=%s",
            exc,
            extra={"auth_error": "expired_token", "auth_method": None},
        )
        raise AuthenticationFailed("Clerk token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        logger.warning(
            "[clerk_auth] Invalid token. error=%s",
            exc,
            extra={"auth_error": "invalid_token", "auth_method": None},
        )
        raise AuthenticationFailed(f"Invalid Clerk token: {exc}") from exc


def _detect_auth_method(
    claims: dict[str, Any],
    has_telegram_id: bool = False,
) -> str:
    """Infer which OAuth provider the user authenticated with.

    Detection order (most-specific first):
    1. Telegram — user has a ``telegram_id`` in the database.
    2. GitHub   — ``image_url`` is an avatars.githubusercontent.com URL.
    3. Google   — ``image_url`` is a lh3.googleusercontent.com URL.
    4. Unknown  — return empty string (displayed as blank in admin).
    """
    if has_telegram_id:
        detected = "telegram"
    else:
        image_url: str = claims.get("image_url") or ""
        if _GITHUB_PATTERN.search(image_url):
            detected = "github"
        elif _GOOGLE_PATTERN.search(image_url):
            detected = "google"
        else:
            detected = ""

    logger.debug(
        "[clerk_auth] Auth method detected: %r  (sub=%s image_url=%r has_telegram=%s)",
        detected,
        claims.get("sub"),
        claims.get("image_url"),
        has_telegram_id,
    )
    return detected


def _derive_unique_username(base: str) -> str:
    """Return a unique Django username derived from *base*."""
    base = (base[:28] or "user").replace(" ", "_").lower()
    username, counter = base, 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{counter}"
        counter += 1
    return username


def _sync_clerk_profile(user: Any, claims: dict[str, Any]) -> None:
    """Sync name, username, avatar URL, and auth_method from Clerk JWT claims.

    Called on every authenticated request so the display data stays current
    without requiring a separate webhook — cheap because we only write when
    the stored value actually differs from what Clerk sent.
    """
    from apps.accounts.models import Profile

    user_fields: list[str] = []

    first_name: str = claims.get("first_name") or ""
    last_name: str = claims.get("last_name") or ""
    if first_name and user.first_name != first_name:
        user.first_name = first_name
        user_fields.append("first_name")
    if last_name and user.last_name != last_name:
        user.last_name = last_name
        user_fields.append("last_name")

    # Prefer the Clerk username (human-readable slug) over the internal
    # user_xxx ID.  Only adopt it when it looks like a real username.
    clerk_username: str = claims.get("username") or ""
    is_real_username = clerk_username and not re.match(
        r"^user_[a-z0-9]{10,}$", clerk_username, re.IGNORECASE
    )
    if is_real_username and user.username != clerk_username:
        if not User.objects.filter(username=clerk_username).exclude(pk=user.pk).exists():
            user.username = clerk_username
            user_fields.append("username")

    # Re-detect and persist auth_method on every request so it stays
    # accurate if the user later links a different OAuth provider.
    has_telegram = bool(getattr(user, "telegram_id", None))
    detected_method = _detect_auth_method(claims, has_telegram_id=has_telegram)
    if detected_method and user.auth_method != detected_method:
        old = user.auth_method
        user.auth_method = detected_method
        user_fields.append("auth_method")
        logger.info(
            "[clerk_auth] Updated auth_method for user pk=%s: %r -> %r",
            user.pk,
            old,
            detected_method,
        )

    if user_fields:
        user.save(update_fields=user_fields)
        logger.debug(
            "[clerk_auth] Synced user pk=%s fields=%s",
            user.pk,
            user_fields,
        )

    # Avatar URL — update Profile row only when the value changes.
    image_url: str = claims.get("image_url") or ""
    if image_url:
        Profile.objects.filter(user=user).exclude(social_avatar_url=image_url).update(
            social_avatar_url=image_url
        )


def get_or_create_from_clerk(claims: dict[str, Any]) -> Any:
    """Map a verified Clerk JWT payload to a Django ``User``.

    Resolution order:
    1. Look up by ``clerk_id`` — fastest path after first login.
    2. Look up by email — links legacy allauth-created users on first Clerk login.
    3. Create a new ``User`` record.

    Profile data (name, avatar, auth_method) is synced from Clerk on every
    call so the frontend always sees up-to-date display info without a
    separate webhook.
    """
    clerk_id: str = claims.get("sub", "")
    if not clerk_id:
        logger.error(
            "[clerk_auth] Token missing 'sub' claim — cannot identify user.",
            extra={
                "auth_error": "missing_sub",
                "auth_method": None,
                "claims_keys": list(claims.keys()),
            },
        )
        raise AuthenticationFailed("Token missing required 'sub' claim.")

    logger.debug(
        "[clerk_auth] Resolving user for clerk_id=%s email=%r",
        clerk_id,
        claims.get("email"),
    )

    # 1. Fast path — already linked.
    try:
        user = User.objects.get(clerk_id=clerk_id)
        logger.debug(
            "[clerk_auth] Fast-path hit: user pk=%s clerk_id=%s auth_method=%r",
            user.pk,
            clerk_id,
            user.auth_method,
        )
        _sync_clerk_profile(user, claims)
        return user
    except User.DoesNotExist:
        pass

    email: str = claims.get("email", "")

    # 2. Adopt an existing account by email (allauth / email-password users).
    if email:
        try:
            user = User.objects.get(email=email)
            user.clerk_id = clerk_id
            fields_to_save = ["clerk_id"]

            # Detect and set auth_method now that we know the clerk_id.
            detected = _detect_auth_method(claims, has_telegram_id=bool(user.telegram_id))
            if detected and user.auth_method != detected:
                user.auth_method = detected
                fields_to_save.append("auth_method")

            user.save(update_fields=fields_to_save)
            _sync_clerk_profile(user, claims)
            logger.info(
                "[clerk_auth] Linked clerk_id=%s to existing user pk=%s via email. auth_method=%r",
                clerk_id,
                user.pk,
                user.auth_method,
            )
            return user
        except User.DoesNotExist:
            pass

    # 3. Create a brand-new Django user.
    clerk_username: str = claims.get("username") or ""
    is_real_username = clerk_username and not re.match(
        r"^user_[a-z0-9]{10,}$", clerk_username, re.IGNORECASE
    )
    base = clerk_username if is_real_username else (email.split("@")[0] if email else clerk_id)
    username = _derive_unique_username(base)

    # When Clerk provides no email use a unique sentinel so the DB unique
    # constraint on email (which disallows blank duplicates) is satisfied.
    email_to_store = email if email else f"clerk_{clerk_id}@no-email.local"

    # Detect auth method before creating the user.
    detected_method = _detect_auth_method(claims, has_telegram_id=False)

    try:
        user, created = User.objects.get_or_create(
            clerk_id=clerk_id,
            defaults=dict(
                username=username,
                email=email_to_store,
                auth_method=detected_method,
                is_active=True,
                first_name=claims.get("first_name") or "",
                last_name=claims.get("last_name") or "",
            ),
        )
    except Exception as exc:
        logger.error(
            "[clerk_auth] Failed to get_or_create user. clerk_id=%s email=%r "
            "detected_method=%r username=%r error=%s",
            clerk_id,
            email_to_store,
            detected_method,
            username,
            exc,
            extra={
                "auth_error": "user_create_failed",
                "auth_method": detected_method,
                "clerk_id": clerk_id,
            },
        )
        raise

    if created:
        logger.info(
            "[clerk_auth] Created new user pk=%s clerk_id=%s username=%r email=%r auth_method=%r",
            user.pk,
            clerk_id,
            username,
            email_to_store,
            detected_method,
        )
    else:
        logger.debug(
            "[clerk_auth] get_or_create returned existing user pk=%s for clerk_id=%s",
            user.pk,
            clerk_id,
        )

    _sync_clerk_profile(user, claims)
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
            logger.debug("[clerk_auth] CLERK_JWKS_URL not set — skipping Clerk auth.")
            return None

        path = getattr(request, "path", "?")
        method = getattr(request, "method", "?")
        logger.debug(
            "[clerk_auth] Authenticating %s %s (token length=%d)",
            method,
            path,
            len(token),
        )

        try:
            claims = _verify_clerk_token(token)
        except AuthenticationFailed as exc:
            logger.warning(
                "[clerk_auth] Token verification failed on %s %s: %s",
                method,
                path,
                exc,
                extra={
                    "auth_error": "verification_failed",
                    "auth_method": None,
                    "path": path,
                },
            )
            raise

        try:
            user = get_or_create_from_clerk(claims)
        except AuthenticationFailed:
            raise
        except Exception as exc:
            logger.error(
                "[clerk_auth] Unexpected error resolving user on %s %s: %s",
                method,
                path,
                exc,
                extra={
                    "auth_error": "resolution_failed",
                    "auth_method": None,
                    "clerk_id": claims.get("sub"),
                    "path": path,
                },
            )
            raise

        logger.debug(
            "[clerk_auth] Auth success — user pk=%s username=%r auth_method=%r path=%s",
            user.pk,
            user.username,
            user.auth_method,
            path,
        )
        return (user, claims)

    def authenticate_header(self, request: "Request") -> str:
        return 'Bearer realm="api"'
