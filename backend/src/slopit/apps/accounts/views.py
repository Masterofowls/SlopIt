"""API views for user accounts — the 'me' resource."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.accounts.models import Profile
from apps.accounts.serializers import ProfileSerializer


class MeViewSet(GenericViewSet):
    """Single-resource viewset for the authenticated user's own profile.

    Routes (mounted at /api/v1/me/):
        GET  /api/v1/me/            → retrieve profile
        PATCH /api/v1/me/           → partial update profile
        GET  /api/v1/me/preferences/ → get feed preferences
        PATCH /api/v1/me/preferences/→ update feed preferences
    """

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self) -> Profile:
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def list(self, request: Request) -> Response:
        """GET /api/v1/me/ — retrieve own profile."""
        serializer = self.get_serializer(self.get_object(), context={"request": request})
        return Response(serializer.data)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        """PATCH /api/v1/me/ — update own profile fields."""
        serializer = self.get_serializer(
            self.get_object(),
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get", "patch"], url_path="preferences")
    def preferences(self, request: Request) -> Response:
        """GET/PATCH /api/v1/me/preferences/ — feed filter preferences."""
        from apps.feed.jobs import enqueue_invalidate_user_snapshots
        from apps.feed.models import FeedPreferences
        from apps.feed.serializers import FeedPreferencesSerializer

        prefs, _ = FeedPreferences.objects.get_or_create(user=request.user)

        if request.method == "GET":
            return Response(FeedPreferencesSerializer(prefs).data)

        serializer = FeedPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        enqueue_invalidate_user_snapshots(request.user.pk)

        return Response(serializer.data, status=status.HTTP_200_OK)
