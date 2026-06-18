from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import Profile, User
from apps.accounts.profile_karma import karma_score
from apps.accounts.user_display import (
    avatar_seed,
    display_name,
    display_name_public,
    profile_avatar_url,
)


class UserBriefSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "display_name", "first_name", "last_name", "email", "avatar_url",
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj: User) -> str | None:
        profile = getattr(obj, "profile", None)
        if profile:
            url = profile_avatar_url(profile, self.context.get("request"))
            if url:
                return url
        from apps.accounts.avatar import generate_avatar_data_url
        return generate_avatar_data_url(avatar_seed(obj, profile))

    def get_display_name(self, obj: User) -> str | None:
        return display_name(obj)


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "username", "display_name", "email", "bio", "avatar", "avatar_url",
            "social_avatar_url", "website_url", "feed_lifetime_hours", "created_at", "updated_at",
        ]
        read_only_fields = [
            "username", "email", "avatar_url", "social_avatar_url", "created_at", "updated_at",
        ]
        extra_kwargs = {
            "avatar": {"write_only": True},
            "display_name": {"required": False, "allow_blank": True},
        }

    def get_avatar_url(self, obj: Profile) -> str | None:
        return profile_avatar_url(obj, self.context.get("request"))

    def to_representation(self, instance: Profile) -> dict[str, object]:
        data = super().to_representation(instance)
        if not data.get("display_name"):
            data["display_name"] = display_name(instance.user)
        return data


class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    post_count = serializers.IntegerField(read_only=True, default=0)
    karma_score = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "username", "display_name", "avatar_url", "bio", "website_url",
            "post_count", "karma_score", "created_at",
        ]
        read_only_fields = fields

    def get_karma_score(self, obj: Profile) -> int:
        return karma_score(obj)

    def get_display_name(self, obj: Profile) -> str:
        return display_name_public(obj)

    def get_avatar_url(self, obj: Profile) -> str | None:
        return profile_avatar_url(obj, self.context.get("request"))
