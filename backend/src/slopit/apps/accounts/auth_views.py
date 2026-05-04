"""Auth-state API views for React SPA integration.

These views complement AllAuth's own OAuth flow.  The OAuth dance itself
(Google / GitHub / Telegram) runs through AllAuth's HTML views at
/accounts/<provider>/login/.  After the callback, AllAuth sets an HttpOnly
session cookie and redirects to LOGIN_REDIRECT_URL ("/").  The frontend
then calls /api/v1/auth/session/ to hydrate its auth state.

Passkey (WebAuthn) registration and authentication use AllAuth's headless
API at /api/v1/_allauth/browser/v1/... — see FRONTEND_GUIDE.md.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.accounts.serializers import ProfileSerializer, UserBriefSerializer


class AuthSessionView(APIView):
    """GET /api/v1/auth/session/ — current session state.

    Returns full user + profile info when authenticated, otherwise a
    lightweight anonymous marker.  Frontend calls this on startup to
    hydrate auth state before rendering.
    """

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        if not request.user.is_authenticated:
            return Response({"authenticated": False, "user": None})

        from apps.accounts.models import Profile

        profile, _ = Profile.objects.get_or_create(user=request.user)
        return Response(
            {
                "authenticated": True,
                "user": {
                    **UserBriefSerializer(request.user).data,
                    "profile": ProfileSerializer(profile, context={"request": request}).data,
                },
            }
        )


class AuthCsrfView(APIView):
    """GET /api/v1/auth/csrf/ — bootstrap CSRF cookie + return token value.

    React apps must call this once on load before making any POST / PATCH /
    DELETE requests.  The endpoint sets the ``csrftoken`` cookie and returns
    the token in the response body so the app can store it in Axios defaults
    (``axios.defaults.headers.common['X-CSRFToken'] = data.csrfToken``).
    """

    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request) -> Response:
        return Response({"csrfToken": get_token(request)})


class AuthLogoutView(APIView):
    """POST /api/v1/auth/logout/ — terminate the current session.

    Requires a valid CSRF token.  Returns 204 No Content on success.
    Frontend should clear any locally-cached user state after this call.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuthProvidersView(APIView):
    """GET /api/v1/auth/providers/ — list available OAuth providers.

    Returns the login URL for each configured provider.  The frontend
    should navigate the *full page* to that URL (not open a popup) so
    AllAuth can set the session cookie after the OAuth callback.

    Example response::

        {
            "providers": [
                {"id": "google",   "name": "Google",   "login_url": "/accounts/google/login/"},
                {"id": "github",   "name": "GitHub",   "login_url": "/accounts/github/login/"},
                {"id": "telegram", "name": "Telegram", "login_url": "/accounts/telegram/login/"},
            ]
        }
    """

    permission_classes = [AllowAny]

    _DISPLAY_NAMES: dict[str, str] = {
        "google": "Google",
        "github": "GitHub",
        "telegram": "Telegram",
    }

    def get(self, request: Request) -> Response:
        from django.conf import settings

        providers = [
            {
                "id": pid,
                "name": self._DISPLAY_NAMES.get(pid, pid.capitalize()),
                "login_url": f"/accounts/{pid}/login/",
            }
            for pid in settings.SOCIALACCOUNT_PROVIDERS
        ]
        return Response({"providers": providers})
