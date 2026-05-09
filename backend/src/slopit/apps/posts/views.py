"""API views for posts and tags."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from django.core.files.storage import default_storage
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.api.pagination import StandardResultsPagination
from apps.api.permissions import IsAuthorOrReadOnly
from apps.posts.models import Media, Post, Tag
from apps.posts.serializers import (
    PostDetailSerializer,
    PostListSerializer,
    PostWriteSerializer,
    TagSerializer,
)

MAX_MEDIA_UPLOAD_BYTES = 500 * 1024 * 1024


class MediaUploadView(APIView):
    """Upload media file and return a public URL for EditorJS image blocks."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request: Request) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"detail": "file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if upload.size > MAX_MEDIA_UPLOAD_BYTES:
            return Response(
                {"detail": "File too large. Maximum size is 500MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        suffix = Path(upload.name or "").suffix.lower()
        filename = f"posts/media/uploads/{uuid4().hex}{suffix}"
        stored_path = default_storage.save(filename, upload)
        file_url = default_storage.url(stored_path)

        media_id: int | None = None
        post_id = request.data.get("post_id")
        if post_id is not None and post_id != "":
            post = Post.objects.filter(pk=post_id, author=request.user).first()
            if post is None:
                return Response(
                    {"detail": "post not found or not owned by current user."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            media_kind = request.data.get("kind", Media.Kind.IMAGE)
            allowed_kinds = {choice[0] for choice in Media.Kind.choices}
            if media_kind not in allowed_kinds:
                return Response(
                    {"detail": (f"kind must be one of: {', '.join(sorted(allowed_kinds))}.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            media = Media.objects.create(
                post=post,
                kind=media_kind,
                file=stored_path,
                processing_status=Media.ProcessingStatus.DONE,
            )
            media_id = media.id

        return Response(
            {
                "url": request.build_absolute_uri(file_url),
                "media_id": media_id,
            },
            status=status.HTTP_201_CREATED,
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
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
        from django.db.models.functions import Coalesce

        from apps.reactions.models import Reaction

        ct = ContentType.objects.get_for_model(Post)

        like_sq = (
            Reaction.objects.filter(
                content_type=ct,
                object_id=OuterRef("pk"),
                kind="like",
            )
            .values("object_id")
            .annotate(c=Count("id"))
            .values("c")
        )
        dislike_sq = (
            Reaction.objects.filter(
                content_type=ct,
                object_id=OuterRef("pk"),
                kind="dislike",
            )
            .values("object_id")
            .annotate(c=Count("id"))
            .values("c")
        )

        qs = (
            Post.objects.select_related("author", "author__profile")
            .prefetch_related("tags", "media")
            .annotate(
                comment_count=Count(
                    "comments",
                    filter=Q(comments__is_deleted=False, comments__parent__isnull=True),
                    distinct=True,
                ),
                like_count=Coalesce(Subquery(like_sq, output_field=IntegerField()), 0),
                dislike_count=Coalesce(Subquery(dislike_sq, output_field=IntegerField()), 0),
            )
            .order_by("-published_at", "-created_at")
        )

        return qs.filter(status=Post.Status.PUBLISHED)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        request = self.request
        if request and request.user.is_authenticated:
            from django.contrib.contenttypes.models import ContentType

            from apps.reactions.models import Reaction

            ct = ContentType.objects.get_for_model(Post)
            rows = Reaction.objects.filter(
                user=request.user,
                content_type=ct,
            ).values("object_id", "kind")
            ctx["user_reactions"] = {r["object_id"]: r["kind"] for r in rows}
        return ctx

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PostWriteSerializer
        if self.action == "retrieve":
            return PostDetailSerializer
        return PostListSerializer

    def perform_create(self, serializer) -> None:  # type: ignore[override]
        serializer.save(
            author=self.request.user,
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )

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
            return Response(PostDetailSerializer(post, context={"request": request}).data)
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
            .select_related("author", "author__profile")
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
        Returns updated reaction_counts and user_reaction.
        """
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Count

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
                user_reaction = None
            else:
                existing.kind = kind
                existing.save(update_fields=["kind"])
                user_reaction = kind
        else:
            Reaction.objects.create(
                user=request.user,
                kind=kind,
                content_type=ct,
                object_id=post.pk,
            )
            user_reaction = kind

        # Return fresh counts so the frontend doesn't need a re-fetch
        qs = Reaction.objects.filter(content_type=ct, object_id=post.pk)
        counts_rows = qs.values("kind").annotate(n=Count("id"))
        reaction_counts = {"like": 0, "dislike": 0}
        for row in counts_rows:
            reaction_counts[row["kind"]] = row["n"]

        return Response(
            {
                "reaction_counts": reaction_counts,
                "user_reaction": user_reaction,
            },
            status=status.HTTP_200_OK,
        )
