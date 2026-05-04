"""Admin registrations for the pages app."""

from __future__ import annotations

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import StaticPage, SystemFlag


@admin.register(StaticPage)
class StaticPageAdmin(ModelAdmin):
    list_display = ["title", "slug", "is_active", "updated_at"]
    list_filter = ["is_active", "slug"]
    search_fields = ["title", "body_markdown"]
    readonly_fields = ["body_html", "created_at", "updated_at"]


@admin.register(SystemFlag)
class SystemFlagAdmin(ModelAdmin):
    list_display = ["key", "value", "updated_at"]
    search_fields = ["key", "description"]
    readonly_fields = ["created_at", "updated_at"]
