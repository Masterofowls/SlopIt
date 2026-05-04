"""Domain models for the 3-level random feed algorithm.

See docs/ALGORITHM.md for the full specification.
L1: PostFeedMeta  — system-wide eligibility index.
L2: handled in services (anti-spam, anti-duplicate, bucket assignment).
L3: FeedSnapshot  — per-user shuffled list of post IDs.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models


class FeedPreferences(models.Model):
    """Per-user content filters applied during L3 snapshot generation."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_preferences",
        primary_key=True,
    )
    # Words that trigger post exclusion (case-insensitive substring match).
    filter_words = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
    )
    # Post kinds to exclude; values from posts.Post.Kind.
    filter_post_types = ArrayField(
        models.CharField(max_length=20),
        default=list,
        blank=True,
    )
    muted_tag_ids = ArrayField(models.BigIntegerField(), default=list, blank=True)
    muted_user_ids = ArrayField(models.BigIntegerField(), default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "feed_feedpreferences"
        verbose_name = "feed preferences"
        verbose_name_plural = "feed preferences"

    def __str__(self) -> str:
        return f"FeedPreferences(user={self.user_id})"


class PostFeedMeta(models.Model):
    """L1 eligibility record for a published post.

    Created when a post is published; updated by L2 intake jobs.
    GIN indexes accelerate per-user preference filtering in L3.
    """

    post = models.OneToOneField(
        "posts.Post",
        on_delete=models.CASCADE,
        related_name="feed_meta",
        primary_key=True,
    )
    # 0-255 anti-clustering bucket assigned by L2 intake.
    bucket = models.PositiveSmallIntegerField(default=0)
    # 64-bit SimHash of (title + body) encoded as 16 hex chars; dedup in L2.
    content_hash = models.CharField(max_length=16, db_index=True)
    kind = models.CharField(max_length=10)  # mirrors posts.Post.kind
    tag_ids = ArrayField(
        models.BigIntegerField(),
        default=list,
        blank=True,
    )
    # Full-text search vector; updated by L2 intake signal.
    keyword_set = SearchVectorField(null=True, blank=True)
    # Rotation offset within the bucket (0-1023) for sub-bucket randomness.
    rotation_offset = models.PositiveSmallIntegerField(default=0)
    published_at = models.DateTimeField(db_index=True)
    is_eligible = models.BooleanField(default=True, db_index=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "feed_postfeedmeta"
        indexes = [
            # Primary L3 scan: eligible posts in a bucket.
            models.Index(fields=["is_eligible", "bucket"], name="pfm_eligible_bucket_idx"),
            # L3 preference filter: exclude muted tags.
            GinIndex(fields=["tag_ids"], name="pfm_tag_ids_gin"),
            # L3 keyword exclusion filter.
            GinIndex(fields=["keyword_set"], name="pfm_keyword_set_gin"),
        ]
        verbose_name = "post feed meta"
        verbose_name_plural = "post feed meta entries"

    def __str__(self) -> str:
        return f"PostFeedMeta(post={self.post_id}, bucket={self.bucket})"


class FeedSnapshot(models.Model):
    """L3 per-user shuffled list of post IDs, valid for `expires_at`.

    The snapshot is reproducible from (user, seed) via the L3 shuffle
    algorithm.  `post_ids` stores ordered IDs; the API serves pages
    by slicing this array.  Only the most recent is_active=True record
    is served; old ones are cleaned up by a background RQ job.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feed_snapshots",
    )
    seed = models.BigIntegerField()  # deterministic shuffle seed
    post_ids = ArrayField(models.BigIntegerField(), default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "feed_feedsnapshot"
        indexes = [
            # Fast lookup of the active snapshot for a user.
            models.Index(
                fields=["user", "is_active", "expires_at"],
                name="snap_user_active_expires_idx",
            ),
        ]
        verbose_name = "feed snapshot"
        verbose_name_plural = "feed snapshots"

    def __str__(self) -> str:
        return f"FeedSnapshot({self.id}, user={self.user_id}, posts={len(self.post_ids)})"
