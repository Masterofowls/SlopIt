"""API views for posts and tags."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.api.pagination import StandardResultsPagination
from apps.api.permissions import IsAuthorOrReadOnly
from apps.posts.models import Post, Tag
from apps.posts.serializers import (
    PostDetailSerializer,
    PostListSerializer,
    PostWriteSerializer,
    TagSerializer,
)


class TagViewSet(ReadOnlyModelViewSet):
    """List and retrieve taxonomy tags.

    Routes:
        GET /api/v1/tags/         → list all tags
        GET /api/v1/tags/{id}/    → tag detail
    """

    queryset = Tag.objects.order_by("name")
    serializer_class = TagSerializer
    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthenticatedOrReadOnly]


class PostViewSet(ModelViewSet):
    """CRUD for posts with publish action and nested comments/reactions.

    Routes:
        GET    /api/v1/posts/               → list published posts
        POST   /api/v1/posts/               → create post (auth required)
        GET    /api/v1/posts/{id}/          → retrieve post detail
        PATCH  /api/v1/posts/{id}/          → update post (author only)
        DELETE /api/v1/posts/{id}/          → remove post (author or admin)
        POST   /api/v1/posts/{id}/publish/  → publish draft (author only)
        GET    /api/v1/posts/{id}/comments/ → list comments for post
        POST   /api/v1/posts/{id}/react/    → toggle reaction (auth required)
    """

    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthorOrReadOnly]
    lookup_field = "pk"

    def get_queryset(self):
        qs = (
            Post.objects.select_related("author")
            .prefetch_related("tags")
            .order_by("-published_at", "-created_at")
        )
        if not self.request.user.is_authenticated:
            return qs.filter(status=Post.Status.PUBLISHED)
        return qs.filter(status=Post.Status.PUBLISHED) | qs.filter(author=self.request.user)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PostWriteSerializer
        if self.action == "retrieve":
            return PostDetailSerializer
        return PostListSerializer

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        serializer.save(author=self.request.user)

    @action(
        detail=True,
        methods=["post"],
        url_path="publish",
        permission_classes=[IsAuthenticated, IsAuthorOrReadOnly],
    )
    def publish(self, request: Request, pk: str | None = None) -> Response:
        """Transition a draft post to published status."""
        post: Post = self.get_object()

        if post.status == Post.Status.PUBLISHED:
            return Response(
                {"detail": "Post is already published."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if post.status == Post.Status.REMOVED:
            return Response(
                {"detail": "Removed posts cannot be republished."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post.status = Post.Status.PUBLISHED
        post.published_at = timezone.now()
        post.save(update_fields=["status", "published_at", "updated_at"])

        return Response(PostDetailSerializer(post, context={"request": request}).data)

    @extend_schema(parameters=[OpenApiParameter("page", int, description="Page number")])
    @action(
        detail=True,
        methods=["get"],
        url_path="comments",
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def comments(self, request: Request, pk: str | None = None) -> Response:
        """List top-level comments for a post (paginated)."""
        from apps.comments.models import Comment
        from apps.comments.serializers import CommentSerializer

        post = self.get_object()
        qs = (
            Comment.objects.filter(post=post, parent__isnull=True)
            .annotate_reply_count()
            .select_related("author")
            .order_by("created_at")
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                CommentSerializer(page, many=True, context={"request": request}).data
            )
        return Response(CommentSerializer(qs, many=True, context={"request": request}).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="react",
        permission_classes=[IsAuthenticated],
    )
    def react(self, request: Request, pk: str | None = None) -> Response:
        """Toggle a like/dislike reaction on a post.

        If the user already has the same reaction, it is removed (toggle off).
        If the user has a different reaction, it is changed.
        """
        from django.contrib.contenttypes.models import ContentType

        from apps.reactions.models import Reaction
        from apps.reactions.serializers import ReactionToggleSerializer

        post = self.get_object()
        serializer = ReactionToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]

        ct = ContentType.objects.get_for_model(Post)
        existing = Reaction.objects.filter(
            user=request.user, content_type=ct, object_id=post.pk
        ).first()

        if existing:
            if existing.kind == kind:
                existing.delete()
                return Response({"detail": "Reaction removed."}, status=status.HTTP_200_OK)
            existing.kind = kind
            existing.save(update_fields=["kind"])
            return Response({"detail": f"Reaction changed to {kind}."})

        Reaction.objects.create(
            user=request.user,
            kind=kind,
            content_type=ct,
            object_id=post.pk,
        )
        return Response({"detail": f"Reaction '{kind}' added."}, status=status.HTTP_201_CREATED)
