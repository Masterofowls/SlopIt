"""Domain models for content moderation: reports and bans."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class Report(models.Model):
    """A user report against a post, comment, or user account."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        REVIEWED = "reviewed", "Reviewed"
        DISMISSED = "dismissed", "Dismissed"
        ACTIONED = "actioned", "Actioned"

    class TargetType(models.TextChoices):
        POST = "post", "Post"
        COMMENT = "comment", "Comment"
        USER = "user", "User"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="filed_reports",
    )
    target_type = models.CharField(max_length=10, choices=TargetType.choices, db_index=True)
    target_id = models.PositiveBigIntegerField(db_index=True)
    reason = models.TextField(max_length=1000)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    notes = models.TextField(blank=True)  # internal moderator notes
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "moderation_report"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]
        verbose_name = "report"
        verbose_name_plural = "reports"

    def __str__(self) -> str:
        return f"Report#{self.pk} [{self.status}] {self.target_type}/{self.target_id}"


class Ban(models.Model):
    """Active ban on a user account.

    Existence of a Ban record means the user is banned.
    To unban: delete the record.  expires_at=None means permanent.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ban",
    )
    reason = models.TextField()
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="issued_bans",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # null = permanent ban
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "moderation_ban"
        verbose_name = "ban"
        verbose_name_plural = "bans"

    def __str__(self) -> str:
        duration = "permanent" if self.is_permanent else f"until {self.expires_at}"
        return f"Ban(user={self.user_id}, {duration})"

    @property
    def is_permanent(self) -> bool:
        return self.expires_at is None
