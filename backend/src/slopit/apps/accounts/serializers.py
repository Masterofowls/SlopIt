"""Serializers for user accounts and profiles."""

from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import Profile, User


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal user representation embedded in posts and comments."""

    class Meta:
        model = User
        fields = ["id", "username"]
        read_only_fields = fields


class ProfileSerializer(serializers.ModelSerializer):
    """Full profile read/write (owner only via MeViewSet)."""

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "username",
            "email",
            "bio",
            "avatar",
            "avatar_url",
            "social_avatar_url",
            "website_url",
            "feed_lifetime_hours",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "username",
            "email",
            "avatar_url",
            "social_avatar_url",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "avatar": {"write_only": True},
        }

    def get_avatar_url(self, obj: Profile) -> str | None:
        request = self.context.get("request")
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.social_avatar_url or None
