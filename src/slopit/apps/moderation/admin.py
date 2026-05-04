"""Admin registrations for the moderation app."""

from __future__ import annotations

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Ban, Report


@admin.register(Report)
class ReportAdmin(ModelAdmin):
    list_display = ["pk", "reporter", "target_type", "target_id", "status", "created_at"]
    list_filter = ["status", "target_type"]
    raw_id_fields = ["reporter", "reviewed_by"]
    readonly_fields = ["created_at", "updated_at"]
    search_fields = ["reporter__username", "reason"]
    date_hierarchy = "created_at"


@admin.register(Ban)
class BanAdmin(ModelAdmin):
    list_display = ["user", "banned_by", "is_permanent", "created_at", "expires_at"]
    raw_id_fields = ["user", "banned_by"]
    readonly_fields = ["created_at"]
    search_fields = ["user__username", "banned_by__username"]
