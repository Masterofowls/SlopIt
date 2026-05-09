"""Serializers for posts and tags."""

from __future__ import annotations

from rest_framework import serializers

from apps.accounts.serializers import UserBriefSerializer
from apps.posts.models import Media, Post, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]
        read_only_fields = ["id", "slug"]


class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = ["id", "kind", "file", "created_at"]
        read_only_fields = ["id", "created_at"]


class PostListSerializer(serializers.ModelSerializer):
    """Compact post representation for feed and list endpoints."""

    author = UserBriefSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    media = MediaSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "kind",
            "status",
            "slug",
            "body_markdown",
            "link_url",
            "author",
            "tags",
            "media",
            "published_at",
            "created_at",
        ]
        read_only_fields = fields


class PostDetailSerializer(serializers.ModelSerializer):
    """Full post representation including rendered HTML body."""

    author = UserBriefSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    media = MediaSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "kind",
            "status",
            "slug",
            "body_markdown",
            "body_html",
            "link_url",
            "author",
            "tags",
            "media",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "body_html", "author", "created_at", "updated_at"]


class PostWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating posts."""

    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        many=True,
        source="tags",
        required=False,
    )

    class Meta:
        model = Post
        fields = [
            "title",
            "kind",
            "body_markdown",
            "link_url",
            "tag_ids",
        ]

    def validate(self, attrs: dict) -> dict:
        kind = attrs.get("kind", Post.Kind.TEXT)
        if kind == Post.Kind.LINK and not attrs.get("link_url"):
            raise serializers.ValidationError(
                {"link_url": "A link URL is required for link-type posts."}
            )
        if kind == Post.Kind.TEXT and not attrs.get("body_markdown"):
            raise serializers.ValidationError(
                {"body_markdown": "Body text is required for text-type posts."}
            )
        return attrs

    def create(self, validated_data: dict) -> Post:
        tags = validated_data.pop("tags", [])
        post = Post.objects.create(**validated_data)
        post.tags.set(tags)
        return post

    def update(self, instance: Post, validated_data: dict) -> Post:
        tags = validated_data.pop("tags", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tags is not None:
            instance.tags.set(tags)
        return instance


