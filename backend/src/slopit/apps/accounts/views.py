"""API views for user accounts — the 'me' resource."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.accounts.models import Profile
from apps.accounts.serializers import ProfileSerializer, PublicProfileSerializer


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

    @action(detail=False, methods=["get"], url_path="bookmarks")
    def bookmarks(self, request: Request) -> Response:
        """GET /api/v1/me/bookmarks/ — list saved posts (paginated)."""
        from apps.api.pagination import StandardResultsPagination
        from apps.posts.models import Bookmark
        from apps.posts.serializers import PostListSerializer

        qs = (
            Bookmark.objects.filter(user=request.user)
            .select_related(
                "post",
                "post__author",
                "post__author__profile",
            )
            .prefetch_related("post__tags", "post__media")
            .order_by("-created_at")
        )

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        items = page if page is not None else qs

        posts = [bm.post for bm in items]
        serialized = PostListSerializer(posts, many=True, context={"request": request}).data

        if page is not None:
            return paginator.get_paginated_response(serialized)
        return Response(serialized)

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


class UserProfileViewSet(GenericViewSet):
    """Public read-only profile for any user.

    Routes:
        GET /api/v1/users/{username}/        → public profile + stats
        GET /api/v1/users/{username}/posts/  → user's published posts (paginated)
    """

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = PublicProfileSerializer
    lookup_field = "username"

    def get_queryset(self):
        from django.db.models import Count, Q

        from apps.accounts.models import User
        from apps.posts.models import Post

        return (
            Profile.objects.select_related("user")
            .annotate(
                post_count=Count(
                    "user__posts",
                    filter=Q(user__posts__status=Post.Status.PUBLISHED),
                    distinct=True,
                )
            )
            .order_by("user__username")
        )

    def retrieve(self, request: Request, username: str | None = None) -> Response:
        """GET /api/v1/users/{username}/"""
        profile = self.get_queryset().filter(user__username=username).first()
        if profile is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(PublicProfileSerializer(profile, context={"request": request}).data)

    @action(
        detail=True,
        methods=["get"],
        url_path="posts",
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def posts(self, request: Request, username: str | None = None) -> Response:
        """GET /api/v1/users/{username}/posts/ — published posts by this user."""
        from apps.api.pagination import StandardResultsPagination
        from apps.posts.models import Post
        from apps.posts.serializers import PostListSerializer

        profile = self.get_queryset().filter(user__username=username).first()
        if profile is None:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        qs = (
            Post.objects.filter(author=profile.user, status=Post.Status.PUBLISHED)
            .select_related("author", "author__profile")
            .prefetch_related("tags", "media")
            .order_by("-published_at", "-created_at")
        )

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        if page is not None:
            return paginator.get_paginated_response(
                PostListSerializer(page, many=True, context={"request": request}).data
            )
        return Response(PostListSerializer(qs, many=True, context={"request": request}).data)
