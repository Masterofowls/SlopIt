"""API views for comments."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.api.pagination import StandardResultsPagination
from apps.api.permissions import IsAuthorOrReadOnly
from apps.comments.models import Comment
from apps.comments.serializers import CommentSerializer, CommentWriteSerializer
from apps.reactions.models import Reaction
from apps.reactions.serializers import ReactionToggleSerializer


def _annotate_comment_reactions(qs):
    """Add like_count and dislike_count annotations to a Comment queryset."""
    ct = ContentType.objects.get_for_model(Comment)
    like_sq = (
        Reaction.objects.filter(content_type=ct, object_id=OuterRef("pk"), kind="like")
        .values("object_id")
        .annotate(c=Count("id"))
        .values("c")
    )
    dislike_sq = (
        Reaction.objects.filter(content_type=ct, object_id=OuterRef("pk"), kind="dislike")
        .values("object_id")
        .annotate(c=Count("id"))
        .values("c")
    )
    return qs.annotate(
        like_count=Coalesce(Subquery(like_sq, output_field=IntegerField()), 0),
        dislike_count=Coalesce(Subquery(dislike_sq, output_field=IntegerField()), 0),
    )


def _build_comment_context(request, comment_ids: list[int]) -> dict:
    """Build serializer context with user's reactions for the given comment ids."""
    ctx = {"request": request}
    if request and request.user.is_authenticated:
        ct = ContentType.objects.get_for_model(Comment)
        rows = Reaction.objects.filter(
            user=request.user,
            content_type=ct,
            object_id__in=comment_ids,
        ).values("object_id", "kind")
        ctx["user_comment_reactions"] = {r["object_id"]: r["kind"] for r in rows}
    return ctx


class CommentViewSet(RetrieveModelMixin, GenericViewSet):
    """Retrieve, create, update, and soft-delete comments.

    Comment listing is handled by PostViewSet.comments (nested under posts).

    Routes:
        GET    /api/v1/comments/{id}/         → retrieve comment
        POST   /api/v1/comments/              → create comment (auth required)
        PATCH  /api/v1/comments/{id}/         → update own comment
        DELETE /api/v1/comments/{id}/         → soft-delete own comment
        GET    /api/v1/comments/{id}/replies/ → list replies
        POST   /api/v1/comments/{id}/react/   → toggle reaction (auth required)
    """

    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthorOrReadOnly]

    def get_queryset(self):
        qs = (
            Comment.objects.annotate_reply_count()
            .select_related("author", "author__profile", "post")
            .order_by("created_at")
        )
        return _annotate_comment_reactions(qs)

    def get_serializer_class(self):
        if self.action == "create":
            return CommentWriteSerializer
        return CommentSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # For single-object retrieve: build user reaction context for just this comment
        if self.kwargs.get("pk"):
            try:
                pk = int(self.kwargs["pk"])
                ctx.update(_build_comment_context(self.request, [pk]))
            except (TypeError, ValueError):
                pass
        return ctx

    def create(self, request: Request) -> Response:
        """POST /api/v1/comments/"""
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(author=request.user)
        # Re-fetch with annotations
        comment = self.get_queryset().get(pk=comment.pk)
        ctx = _build_comment_context(request, [comment.pk])
        return Response(
            CommentSerializer(comment, context=ctx).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        """PATCH /api/v1/comments/{id}/"""
        comment: Comment = self.get_object()
        serializer = CommentWriteSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        comment = self.get_queryset().get(pk=comment.pk)
        ctx = _build_comment_context(request, [comment.pk])
        return Response(CommentSerializer(comment, context=ctx).data)

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        """DELETE /api/v1/comments/{id}/ — soft delete (preserves thread structure)."""
        comment: Comment = self.get_object()
        comment.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["get"],
        url_path="replies",
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def replies(self, request: Request, pk: str | None = None) -> Response:
        """GET /api/v1/comments/{id}/replies/ — list all replies to this comment."""
        parent: Comment = self.get_object()
        qs = _annotate_comment_reactions(
            Comment.objects.filter(parent=parent)
            .annotate_reply_count()
            .select_related("author", "author__profile")
            .order_by("created_at")
        )
        page = self.paginate_queryset(qs)
        comment_ids = [c.pk for c in (page if page is not None else qs)]
        ctx = _build_comment_context(request, comment_ids)
        if page is not None:
            return self.get_paginated_response(CommentSerializer(page, many=True, context=ctx).data)
        return Response(CommentSerializer(qs, many=True, context=ctx).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="react",
        permission_classes=[IsAuthenticated],
    )
    def react(self, request: Request, pk: str | None = None) -> Response:
        """POST /api/v1/comments/{id}/react/ — toggle like/dislike on a comment."""
        comment: Comment = self.get_object()
        serializer = ReactionToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]

        ct = ContentType.objects.get_for_model(Comment)
        existing = Reaction.objects.filter(
            user=request.user,
            content_type=ct,
            object_id=comment.pk,
        ).first()

        user_reaction: str | None
        if existing is None:
            Reaction.objects.create(
                user=request.user,
                content_type=ct,
                object_id=comment.pk,
                kind=kind,
            )
            user_reaction = kind
        elif existing.kind == kind:
            existing.delete()
            user_reaction = None
        else:
            existing.kind = kind
            existing.save(update_fields=["kind"])
            user_reaction = kind

        # Return fresh counts
        ct_id = ct.pk
        like_count = Reaction.objects.filter(
            content_type_id=ct_id, object_id=comment.pk, kind="like"
        ).count()
        dislike_count = Reaction.objects.filter(
            content_type_id=ct_id, object_id=comment.pk, kind="dislike"
        ).count()

        return Response(
            {
                "like_count": like_count,
                "dislike_count": dislike_count,
                "user_reaction": user_reaction,
            }
        )
