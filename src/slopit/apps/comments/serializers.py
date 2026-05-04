"""Serializers for comments."""

from __future__ import annotations

from rest_framework import serializers

from apps.accounts.serializers import UserBriefSerializer
from apps.comments.models import Comment


class CommentSerializer(serializers.ModelSerializer):
    """Read serializer: renders a comment with author info.

    Soft-deleted comments show empty body fields to preserve thread structure.
    """

    author = UserBriefSerializer(read_only=True)
    reply_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Comment
        fields = [
            "id",
            "post",
            "parent",
            "author",
            "body_html",
            "is_deleted",
            "reply_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "post",
            "author",
            "body_html",
            "is_deleted",
            "reply_count",
            "created_at",
            "updated_at",
        ]


class CommentWriteSerializer(serializers.ModelSerializer):
    """Write serializer for creating and editing comments."""

    class Meta:
        model = Comment
        fields = ["post", "parent", "body_markdown"]

    def validate_parent(self, parent: Comment | None) -> Comment | None:
        if parent is None:
            return None
        post = self.initial_data.get("post")
        if str(parent.post_id) != str(post):
            raise serializers.ValidationError("Parent comment must belong to the same post.")
        if parent.parent_id is not None:
            raise serializers.ValidationError("Replies to replies are not allowed.")
        return parent

    def create(self, validated_data: dict) -> Comment:
        # Author injected by perform_create.
        return Comment.objects.create(**validated_data)
