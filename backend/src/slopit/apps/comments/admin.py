"""Admin registrations for the comments app."""

from __future__ import annotations

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Comment


@admin.register(Comment)
class CommentAdmin(ModelAdmin):
    list_display = ["pk", "author", "post", "is_deleted", "created_at"]
    list_filter = ["is_deleted"]
    raw_id_fields = ["post", "author", "parent"]
    readonly_fields = ["body_html", "created_at", "updated_at"]
    search_fields = ["author__username", "body_markdown"]
    actions = ["soft_delete_selected"]

    @admin.action(description="Soft-delete selected comments")
    def soft_delete_selected(self, request: object, queryset: object) -> None:
        for comment in queryset:  # type: ignore[attr-defined]
            comment.soft_delete()
