"""Admin registrations for the reactions app."""

from __future__ import annotations

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Reaction


@admin.register(Reaction)
class ReactionAdmin(ModelAdmin):
    list_display = ["user", "kind", "content_type", "object_id", "created_at"]
    list_filter = ["kind", "content_type"]
    raw_id_fields = ["user"]
    readonly_fields = ["content_type", "object_id", "created_at"]
    search_fields = ["user__username"]
