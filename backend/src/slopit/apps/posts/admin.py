"""Admin registrations for the posts app."""

from __future__ import annotations

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Media, Post, Tag


@admin.register(Tag)
class TagAdmin(ModelAdmin):
    list_display = ["name", "slug", "created_at"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Post)
class PostAdmin(ModelAdmin):
    list_display = ["title", "author", "kind", "status", "published_at", "created_at"]
    list_filter = ["status", "kind"]
    search_fields = ["title", "author__username"]
    raw_id_fields = ["author"]
    readonly_fields = ["body_html", "slug", "created_at", "updated_at"]
    filter_horizontal = ["tags"]
    date_hierarchy = "created_at"


@admin.register(Media)
class MediaAdmin(ModelAdmin):
    list_display = ["post", "kind", "processing_status", "file_size", "created_at"]
    list_filter = ["kind", "processing_status"]
    raw_id_fields = ["post"]
    readonly_fields = ["created_at"]
