"""Domain model for generic like/dislike reactions on posts and comments."""

from __future__ import annotations

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class Reaction(models.Model):
    """A like or dislike on any content object (Post or Comment).

    Reactions do NOT influence feed ordering — the feed algorithm is
    intentionally random and popularity-agnostic (see docs/ALGORITHM.md).
    """

    class Kind(models.TextChoices):
        LIKE = "like", "Like"
        DISLIKE = "dislike", "Dislike"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    # Generic relation: supports both Post and Comment targets.
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
    )
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reactions_reaction"
        # Each user can react at most once per object (toggle via update).
        unique_together = [("user", "content_type", "object_id")]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
        ]
        verbose_name = "reaction"
        verbose_name_plural = "reactions"

    def __str__(self) -> str:
        return f"{self.kind} by User#{self.user_id} on {self.content_type}/{self.object_id}"
