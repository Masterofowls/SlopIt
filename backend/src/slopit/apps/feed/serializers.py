"""Serializers for feed preferences and snapshot page responses."""

from __future__ import annotations

from rest_framework import serializers

from apps.feed.models import FeedPreferences


class FeedPreferencesSerializer(serializers.ModelSerializer):
    """Read/write serializer for a user's feed filter preferences."""

    class Meta:
        model = FeedPreferences
        fields = [
            "filter_words",
            "filter_post_types",
            "muted_tag_ids",
            "muted_user_ids",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
