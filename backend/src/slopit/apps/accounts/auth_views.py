
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

    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request) -> Response:
        return Response({"csrfToken": get_token(request)})


class AuthLogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuthProvidersView(APIView):

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        return Response({"auth_mode": "clerk", "providers": []})
