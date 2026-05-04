"""Admin registrations for the feed app."""

from __future__ import annotations

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import FeedPreferences, FeedSnapshot, PostFeedMeta


@admin.register(FeedPreferences)
class FeedPreferencesAdmin(ModelAdmin):
    list_display = ["user", "updated_at"]
    raw_id_fields = ["user"]
    readonly_fields = ["updated_at"]
    search_fields = ["user__username"]


@admin.register(PostFeedMeta)
class PostFeedMetaAdmin(ModelAdmin):
    list_display = ["post", "bucket", "kind", "is_eligible", "published_at", "version"]
    list_filter = ["is_eligible", "kind"]
    raw_id_fields = ["post"]
    readonly_fields = ["content_hash", "keyword_set"]
    search_fields = ["post__title"]


@admin.register(FeedSnapshot)
class FeedSnapshotAdmin(ModelAdmin):
    list_display = ["id", "user", "is_active", "created_at", "expires_at", "version"]
    list_filter = ["is_active"]
    raw_id_fields = ["user"]
    readonly_fields = ["id", "seed", "post_ids", "created_at"]
    search_fields = ["user__username"]
