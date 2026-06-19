
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

    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self) -> Profile:
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def list(self, request: Request) -> Response:
        serializer = self.get_serializer(self.get_object(), context={"request": request})
        return Response(serializer.data)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
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
        from apps.feed.services.level3_personal import invalidate_user_snapshots
        from apps.feed.models import FeedPreferences
        from apps.feed.serializers import FeedPreferencesSerializer

        prefs, _ = FeedPreferences.objects.get_or_create(user=request.user)

        if request.method == "GET":
            return Response(FeedPreferencesSerializer(prefs).data)

        serializer = FeedPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        invalidate_user_snapshots(request.user.pk)

        return Response(serializer.data, status=status.HTTP_200_OK)


class UserProfileViewSet(GenericViewSet):

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
