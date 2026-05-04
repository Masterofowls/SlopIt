"""Domain models for posts, tags, and media attachments."""

from __future__ import annotations

import textwrap

from django.conf import settings
from django.db import models
from django.utils.text import slugify

_MARKDOWN_ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "s",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
]
_MARKDOWN_ALLOWED_ATTRS = {"a": ["href", "rel", "title"]}


def _render_markdown(source: str) -> str:
    """Render Markdown to sanitised HTML.  Requires `markdown` + `bleach`."""
    import bleach
    import markdown as md

    raw_html = md.markdown(
        source,
        extensions=["extra", "codehilite", "nl2br"],
    )
    return bleach.clean(
        raw_html,
        tags=_MARKDOWN_ALLOWED_TAGS,
        attributes=_MARKDOWN_ALLOWED_ATTRS,
        strip=True,
    )


class Tag(models.Model):
    """Taxonomy tag that can be applied to posts."""

    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=60, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_tag"
        ordering = ["name"]
        verbose_name = "tag"
        verbose_name_plural = "tags"

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        if not self.slug:
            self.slug = slugify(self.name)[:60]
        super().save(*args, **kwargs)


class Post(models.Model):
    """A user-submitted piece of content."""

    class Kind(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        LINK = "link", "Link"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PROCESSING = "processing", "Processing"
        PUBLISHED = "published", "Published"
        REMOVED = "removed", "Removed"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    title = models.CharField(max_length=300)
    body_markdown = models.TextField(blank=True)
    # Cached sanitised HTML; updated on every save when body_markdown changes.
    body_html = models.TextField(blank=True, editable=False)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    link_url = models.URLField(blank=True, max_length=2000)
    slug = models.SlugField(max_length=120, unique=True, blank=True, db_index=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="posts")
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "posts_post"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "published_at"]),
            models.Index(fields=["author", "status"]),
        ]
        verbose_name = "post"
        verbose_name_plural = "posts"

    def __str__(self) -> str:
        return textwrap.shorten(self.title, width=60)

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        # Re-render HTML whenever markdown body changes.
        if self.body_markdown:
            self.body_html = _render_markdown(self.body_markdown)
        # Assign slug after first insert (needs pk).
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new and not self.slug:
            base = slugify(self.title)[:100]
            self.slug = f"{base}-{self.pk}"
            Post.objects.filter(pk=self.pk).update(slug=self.slug)


class Media(models.Model):
    """File attachment linked to a post (image, video, gif)."""

    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"
        GIF = "gif", "GIF"

    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="media",
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    file = models.FileField(upload_to="posts/media/")
    thumbnail = models.ImageField(
        upload_to="posts/thumbs/",
        null=True,
        blank=True,
    )
    mime_type = models.CharField(max_length=100)
    # File size in bytes; BigInteger supports files up to ~9 EB.
    file_size = models.PositiveBigIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)  # video only
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_media"
        ordering = ["created_at"]
        verbose_name = "media"
        verbose_name_plural = "media"

    def __str__(self) -> str:
        return f"{self.kind.upper()} for Post#{self.post_id}"
