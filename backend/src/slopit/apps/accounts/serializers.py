"""Serializers for user accounts and profiles."""

from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import Profile, User


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal user representation embedded in posts and comments."""

    avatar_url = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "first_name", "last_name", "email", "avatar_url"]
        read_only_fields = fields

    def get_avatar_url(self, obj: User) -> str | None:
        """Return the best available avatar URL for this user."""
        profile = getattr(obj, "profile", None)
        if profile:
            if profile.social_avatar_url:
                return profile.social_avatar_url
            if profile.avatar:
                request = self.context.get("request")
                if request:
                    return request.build_absolute_uri(profile.avatar.url)
        return None

    def get_display_name(self, obj: User) -> str:
        """Return a human-readable name, never a raw Clerk user_xxx ID."""
        import re
        is_clerk_id = lambda s: bool(s and re.match(r"^(clerk_)?user_[a-z0-9]{6,}", s, re.IGNORECASE))
        full = " ".join(filter(None, [obj.first_name, obj.last_name])).strip()
        if full:
            return full
        if obj.username and not is_clerk_id(obj.username):
            return obj.username
        if obj.email:
            return obj.email.split("@")[0]
        return "anon"


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
