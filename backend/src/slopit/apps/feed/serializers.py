
from __future__ import annotations

from rest_framework import serializers

from apps.feed.models import FeedPreferences


class FeedPreferencesSerializer(serializers.ModelSerializer):

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
