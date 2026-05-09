"""API views for comments."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import status
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.api.pagination import StandardResultsPagination
from apps.api.permissions import IsAuthorOrReadOnly
from apps.comments.models import Comment
from apps.comments.serializers import CommentSerializer, CommentWriteSerializer


class CommentViewSet(RetrieveModelMixin, GenericViewSet):
    """Retrieve, create, update, and soft-delete comments.

    Comment listing is handled by PostViewSet.comments (nested under posts).

    Routes:
        GET    /api/v1/comments/{id}/       → retrieve comment
        POST   /api/v1/comments/            → create comment (auth required)
        PATCH  /api/v1/comments/{id}/       → update own comment
        DELETE /api/v1/comments/{id}/       → soft-delete own comment
    """

    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthorOrReadOnly]

    def get_queryset(self):
        return (
            Comment.objects.annotate_reply_count()
            .select_related("author", "post")
            .order_by("created_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return CommentWriteSerializer
        return CommentSerializer

    def create(self, request: Request) -> Response:
        """POST /api/v1/comments/"""
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(author=request.user)
        return Response(
            CommentSerializer(comment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        """PATCH /api/v1/comments/{id}/"""
        comment: Comment = self.get_object()
        serializer = CommentWriteSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        return Response(CommentSerializer(comment, context={"request": request}).data)

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        """DELETE /api/v1/comments/{id}/ — soft delete (preserves thread structure)."""
        comment: Comment = self.get_object()
        comment.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
