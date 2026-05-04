"""Domain model for threaded comments on posts."""

from __future__ import annotations

from django.conf import settings
from django.db import models


def _render_markdown(source: str) -> str:
    import bleach
    import markdown as md

    raw_html = md.markdown(source, extensions=["extra", "nl2br"])
    return bleach.clean(
        raw_html,
        tags=["p", "br", "strong", "em", "s", "code", "a", "ul", "ol", "li", "blockquote"],
        attributes={"a": ["href", "rel", "title"]},
        strip=True,
    )


class CommentQuerySet(models.QuerySet):
    def annotate_reply_count(self) -> CommentQuerySet:
        return self.annotate(reply_count=models.Count("replies", distinct=True))


class Comment(models.Model):
    """A user comment on a post, supporting one level of threading."""

    objects: CommentQuerySet = CommentQuerySet.as_manager()  # type: ignore[assignment]

    post = models.ForeignKey(
        "posts.Post",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    body_markdown = models.TextField(max_length=5000)
    body_html = models.TextField(blank=True, editable=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "comments_comment"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["post", "is_deleted", "created_at"]),
            models.Index(fields=["parent"]),
        ]
        verbose_name = "comment"
        verbose_name_plural = "comments"

    def __str__(self) -> str:
        return f"Comment#{self.pk} by {self.author_id} on Post#{self.post_id}"

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        if self.body_markdown:
            self.body_html = _render_markdown(self.body_markdown)
        super().save(*args, **kwargs)

    def soft_delete(self) -> None:
        """Erase content without removing the node from the thread tree."""
        self.body_markdown = ""
        self.body_html = ""
        self.is_deleted = True
        self.save(update_fields=["body_markdown", "body_html", "is_deleted", "updated_at"])
