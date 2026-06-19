
from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.accounts.models import AuthMethod, Profile
from apps.accounts.password_serializers import PasswordLoginSerializer, PasswordRegisterSerializer
from apps.accounts.serializers import ProfileSerializer, UserBriefSerializer

SESSION_BACKEND = "django.contrib.auth.backends.ModelBackend"


def _session_payload(request: Request, user) -> dict:
    profile, _ = Profile.objects.get_or_create(user=user)
    return {
        "authenticated": True,
        "user": {
            **UserBriefSerializer(user, context={"request": request}).data,
            "profile": ProfileSerializer(profile, context={"request": request}).data,
        },
    }


class AuthSessionView(APIView):

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        if not request.user.is_authenticated:
            return Response({"authenticated": False, "user": None})

        return Response(_session_payload(request, request.user))


class AuthCsrfView(APIView):

    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request) -> Response:
        return Response({"csrfToken": get_token(request)})


class AuthRegisterView(APIView):

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user, backend=SESSION_BACKEND)
        return Response(_session_payload(request, user), status=status.HTTP_201_CREATED)


class AuthLoginView(APIView):

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user, backend=SESSION_BACKEND)
        return Response(_session_payload(request, user))


class AuthLogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuthProvidersView(APIView):

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        return Response(
            {
                "auth_mode": "multi",
                "providers": [
                    AuthMethod.PASSWORD,
                    "clerk",
                    AuthMethod.TELEGRAM,
                ],
                "password_registration": True,
            }
        )
