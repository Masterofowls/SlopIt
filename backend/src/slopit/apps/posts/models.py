"""Domain models for posts, tags, and media attachments."""

from __future__ import annotations

import textwrap
import uuid

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
    "img",
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
_MARKDOWN_ALLOWED_ATTRS = {
    "a": ["href", "rel", "title"],
    "img": ["src", "alt", "loading"],
}


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
        POLL = "poll", "Poll"
        ALERT = "alert", "Alert"
        NEWS = "news", "News"

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
    body_html = models.TextField(blank=True, editable=False)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEXT)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    link_url = models.URLField(blank=True, max_length=2000)
    slug = models.SlugField(max_length=120, unique=True, blank=True, db_index=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="posts")
    template_data = models.JSONField(
        blank=True,
        null=True,
        help_text=(
            "Structured data for template kinds. "
            "Poll: {options: [{text, votes}], allow_multiple: bool}. "
            "Alert: {level: info|warn|danger, icon: str}."
        ),
    )
    view_count = models.IntegerField(default=0)
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
        if self.body_markdown:
            self.body_html = _render_markdown(self.body_markdown)
        if not self.slug:
            base = slugify(self.title)[:100] or "post"
            self.slug = f"{base}-{uuid.uuid4().hex[:8]}"
        super().save(*args, **kwargs)


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
    file_size = models.PositiveBigIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
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


class PollVote(models.Model):
    """Records a single user's vote on a poll post.

    ``option_index`` is a zero-based index into ``Post.template_data["options"]``.
    One row per user per poll.  To change a vote, update the existing row.
    """

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="poll_votes",
        limit_choices_to={"kind": Post.Kind.POLL},
    )
    voter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="poll_votes",
    )
    option_index = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "posts_pollvote"
        unique_together = [("post", "voter")]
        verbose_name = "poll vote"
        verbose_name_plural = "poll votes"

    def __str__(self) -> str:
        return f"Vote by user#{self.voter_id} on Poll#{self.post_id} → option {self.option_index}"


class Bookmark(models.Model):
    """Records a user saving a post for later reading."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookmarks",
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="bookmarks",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_bookmark"
        unique_together = [("user", "post")]
        ordering = ["-created_at"]
        verbose_name = "bookmark"
        verbose_name_plural = "bookmarks"

    def __str__(self) -> str:
        return f"Bookmark by user#{self.user_id} on Post#{self.post_id}"


class PostReport(models.Model):
    """Records a user reporting a post for moderation."""

    class Reason(models.TextChoices):
        SPAM = "spam", "Spam"
        HATE = "hate", "Hate speech"
        MISINFORMATION = "misinfo", "Misinformation"
        NSFW = "nsfw", "NSFW / inappropriate"
        OTHER = "other", "Other"

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_reports",
    )
    reason = models.CharField(
        max_length=10,
        choices=Reason.choices,
        default=Reason.OTHER,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "posts_postreport"
        unique_together = [("post", "reporter")]
        ordering = ["-created_at"]
        verbose_name = "post report"
        verbose_name_plural = "post reports"

    def __str__(self) -> str:
        return f"Report by user#{self.reporter_id} on Post#{self.post_id} [{self.reason}]"
