"""Serializers for posts and tags."""

from __future__ import annotations

from rest_framework import serializers

from apps.accounts.serializers import UserBriefSerializer
from apps.posts.models import Media, Post, Tag


def _build_reaction_counts(obj) -> dict:
    """Return like/dislike counts from queryset annotations or a fallback query."""
    like = getattr(obj, "like_count", None)
    dislike = getattr(obj, "dislike_count", None)
    if like is None or dislike is None:
        # Fallback for views that bypass the annotated queryset
        from django.contrib.contenttypes.models import ContentType

        from apps.reactions.models import Reaction

        ct = ContentType.objects.get_for_model(Post)
        qs = Reaction.objects.filter(content_type=ct, object_id=obj.pk)
        like = qs.filter(kind="like").count()
        dislike = qs.filter(kind="dislike").count()
    return {"like": like or 0, "dislike": dislike or 0}


def _get_user_reaction(obj, context) -> str | None:
    """Return the current user's reaction kind ('like'/'dislike') or None."""
    # Fast path: user_reactions dict injected by PostViewSet.get_serializer_context
    user_reactions = context.get("user_reactions")
    if user_reactions is not None:
        return user_reactions.get(obj.pk)
    # Fallback: per-object query (used by views that don't inject user_reactions)
    request = context.get("request")
    if not request or not request.user.is_authenticated:
        return None
    from django.contrib.contenttypes.models import ContentType

    from apps.reactions.models import Reaction

    ct = ContentType.objects.get_for_model(Post)
    reaction = Reaction.objects.filter(user=request.user, content_type=ct, object_id=obj.pk).first()
    return reaction.kind if reaction else None


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
    reaction_counts = serializers.SerializerMethodField()
    comment_count = serializers.IntegerField(read_only=True, default=0)
    user_reaction = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    def get_reaction_counts(self, obj):
        return _build_reaction_counts(obj)

    def get_user_reaction(self, obj):
        return _get_user_reaction(obj, self.context)

    def get_is_bookmarked(self, obj):
        bookmarks = self.context.get("user_bookmarks")
        if bookmarks is not None:
            return obj.pk in bookmarks
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from apps.posts.models import Bookmark

        return Bookmark.objects.filter(user=request.user, post=obj).exists()

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
            "template_data",
            "author",
            "tags",
            "media",
            "reaction_counts",
            "comment_count",
            "user_reaction",
            "view_count",
            "toxicity_score",
            "is_bookmarked",
            "published_at",
            "created_at",
        ]
        read_only_fields = fields


class PostDetailSerializer(serializers.ModelSerializer):
    """Full post representation including rendered HTML body."""

    author = UserBriefSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    media = MediaSerializer(many=True, read_only=True)
    reaction_counts = serializers.SerializerMethodField()
    comment_count = serializers.IntegerField(read_only=True, default=0)
    user_reaction = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    def get_reaction_counts(self, obj):
        return _build_reaction_counts(obj)

    def get_user_reaction(self, obj):
        return _get_user_reaction(obj, self.context)

    def get_is_bookmarked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from apps.posts.models import Bookmark

        return Bookmark.objects.filter(user=request.user, post=obj).exists()

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
            "template_data",
            "author",
            "tags",
            "media",
            "reaction_counts",
            "comment_count",
            "user_reaction",
            "view_count",
            "toxicity_score",
            "is_bookmarked",
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
            "template_data",
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
        if kind == Post.Kind.POLL:
            td = attrs.get("template_data") or {}
            options = td.get("options", [])
            if not isinstance(options, list) or len(options) < 2:
                raise serializers.ValidationError(
                    {"template_data": "Poll posts require at least 2 options."}
                )
            # Normalise: ensure each option has text + votes counter
            attrs["template_data"] = {
                **td,
                "options": [{"text": str(o.get("text", "") or ""), "votes": 0} for o in options],
            }
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


class PollVoteSerializer(serializers.Serializer):
    """Accepts a poll option index from the voter."""

    option_index = serializers.IntegerField(min_value=0)


class BookmarkSerializer(serializers.ModelSerializer):
    """Serialiser for the Bookmark model — used in list + create responses."""

    post = PostListSerializer(read_only=True)

    class Meta:
        from apps.posts.models import Bookmark

        model = Bookmark
        fields = ["id", "post", "created_at"]
        read_only_fields = fields
