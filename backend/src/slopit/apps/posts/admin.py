"""Admin registrations for the posts app."""

from __future__ import annotations

from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from unfold.admin import ModelAdmin, TabularInline

from .models import Media, Post, Tag


@admin.action(description="Publish selected posts")
def publish_posts(modeladmin: object, request: object, queryset: object) -> None:  # noqa: ARG001
    """Set status=published and published_at=now for every selected draft post."""
    now = timezone.now()
    for post in queryset.filter(status__in=[Post.Status.DRAFT, Post.Status.REMOVED]):
        post.status = Post.Status.PUBLISHED
        if not post.published_at:
            post.published_at = now
        post.save()  # triggers the post_save signal → on_post_published


@admin.register(Tag)
class TagAdmin(ModelAdmin):
    list_display = ["name", "slug", "created_at"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


class MediaInline(TabularInline):
    """Media attachments shown inline on the Post change page."""

    model = Media
    extra = 1
    # mime_type / file_size / kind are auto-detected in Media.save()
    fields = ["inline_preview", "file", "thumbnail", "kind"]
    readonly_fields = ["inline_preview"]
    show_change_link = True

    @admin.display(description="Превью")
    def inline_preview(self, obj: Media) -> str:
        src = None
        if obj.thumbnail:
            src = obj.thumbnail.url
        elif obj.kind == Media.Kind.IMAGE and obj.file:
            src = obj.file.url
        if src:
            return format_html(
                '<img src="{}" style="height:56px;width:56px;object-fit:cover;'
                'border-radius:4px;" loading="lazy">',
                src,
            )
        if obj.pk:
            icon = {"video": "🎬", "gif": "🎞️"}.get(obj.kind, "📄")
            return mark_safe(f'<span style="font-size:1.8rem">{icon}</span>')
        return "—"


@admin.register(Post)
class PostAdmin(ModelAdmin):
    list_display = ["title", "author", "kind", "status", "published_at", "created_at"]
    list_filter = ["status", "kind"]
    search_fields = ["title", "author__username"]
    autocomplete_fields = ["author"]
    readonly_fields = ["body_html", "slug", "created_at", "updated_at"]
    filter_horizontal = ["tags"]
    date_hierarchy = "created_at"
    inlines = [MediaInline]
    actions = [publish_posts]


def _human_size(n: int) -> str:
    """Return a human-readable file size string."""
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024  # type: ignore[assignment]
    return f"{n:.1f} TB"


@admin.register(Media)
class MediaAdmin(ModelAdmin):
    # ── List view ─────────────────────────────────────────────────────────────
    list_display = [
        "thumbnail_preview",
        "post_link",
        "kind",
        "processing_status",
        "human_size",
        "mime_type",
        "dimensions",
        "created_at",
    ]
    list_display_links = ["thumbnail_preview", "post_link"]
    list_filter = ["kind", "processing_status"]
    search_fields = [
        "post__title",
        "post__author__username",
        "post__author__email",
        "mime_type",
    ]
    ordering = ["-created_at"]
    list_per_page = 30
    date_hierarchy = "created_at"
    autocomplete_fields = ["post"]

    # ── Detail view ───────────────────────────────────────────────────────────
    readonly_fields = [
        "media_preview",
        "file_link",
        "human_size",
        "dimensions",
        "created_at",
    ]
    fieldsets = [
        (
            "Файл",
            {
                "fields": [
                    "media_preview",
                    "file",
                    "file_link",
                    "thumbnail",
                    "mime_type",
                    "human_size",
                    "dimensions",
                    "duration_seconds",
                ],
            },
        ),
        (
            "Привязка и статус",
            {
                "fields": ["post", "kind", "processing_status"],
            },
        ),
        (
            "Метаданные",
            {
                "fields": ["created_at"],
                "classes": ["collapse"],
            },
        ),
    ]

    # ── Custom actions ────────────────────────────────────────────────────────
    actions = ["mark_done", "mark_failed", "mark_pending"]

    @admin.action(description="✅ Отметить как «Done»")
    def mark_done(self, request, queryset):  # type: ignore[override]
        updated = queryset.update(processing_status=Media.ProcessingStatus.DONE)
        self.message_user(request, f"{updated} файл(ов) → done.")

    @admin.action(description="❌ Отметить как «Failed»")
    def mark_failed(self, request, queryset):  # type: ignore[override]
        updated = queryset.update(processing_status=Media.ProcessingStatus.FAILED)
        self.message_user(request, f"{updated} файл(ов) → failed.")

    @admin.action(description="⏳ Отметить как «Pending»")
    def mark_pending(self, request, queryset):  # type: ignore[override]
        updated = queryset.update(processing_status=Media.ProcessingStatus.PENDING)
        self.message_user(request, f"{updated} файл(ов) → pending.")

    # ── Computed columns ──────────────────────────────────────────────────────
    @admin.display(description="Превью", ordering="thumbnail")
    def thumbnail_preview(self, obj: Media) -> str:
        src = None
        if obj.thumbnail:
            src = obj.thumbnail.url
        elif obj.kind == Media.Kind.IMAGE and obj.file:
            src = obj.file.url
        if src:
            return format_html(
                '<img src="{}" style="height:48px;width:48px;object-fit:cover;'
                'border-radius:4px;" loading="lazy">',
                src,
            )
        icon = {"video": "🎬", "gif": "🎞️"}.get(obj.kind, "📄")
        return mark_safe(f'<span style="font-size:2rem">{icon}</span>')

    @admin.display(description="Пост", ordering="post__title")
    def post_link(self, obj: Media) -> str:
        url = f"/admin/posts/post/{obj.post_id}/change/"
        title = str(obj.post)[:50]
        return format_html('<a href="{}">{}</a>', url, title)

    @admin.display(description="Размер", ordering="file_size")
    def human_size(self, obj: Media) -> str:
        return _human_size(obj.file_size)

    @admin.display(description="Размеры")
    def dimensions(self, obj: Media) -> str:
        if obj.width and obj.height:
            return f"{obj.width}×{obj.height}"
        return "—"

    @admin.display(description="Просмотр файла")
    def media_preview(self, obj: Media) -> str:
        if not obj.file:
            return "—"
        url = obj.file.url
        if obj.kind == Media.Kind.IMAGE or obj.mime_type.startswith("image/"):
            return format_html(
                '<img src="{}" style="max-width:480px;max-height:360px;'
                'border-radius:6px;margin-top:4px;" loading="lazy">',
                url,
            )
        if obj.kind == Media.Kind.VIDEO or obj.mime_type.startswith("video/"):
            return format_html(
                '<video controls style="max-width:480px;max-height:360px;'
                'border-radius:6px;margin-top:4px;">'
                '<source src="{}" type="{}">'
                "Ваш браузер не поддерживает тег video."
                "</video>",
                url,
                obj.mime_type,
            )
        return format_html('<a href="{}" target="_blank">Скачать файл</a>', url)

    @admin.display(description="URL файла")
    def file_link(self, obj: Media) -> str:
        if not obj.file:
            return "—"
        url = obj.file.url
        return format_html('<a href="{}" target="_blank">{}</a>', url, url)
