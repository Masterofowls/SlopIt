"""RQ background jobs for the feed algorithm.

Enqueuers (call from Django application code):
    enqueue_post_published(post_id)             → queue=default
    enqueue_mark_ineligible(post_ids)            → queue=low
    enqueue_mark_author_ineligible(author_id)    → queue=low
    enqueue_invalidate_user_snapshots(user_id)   → queue=default

Periodic jobs (schedule via django-rq-scheduler or external cron):
    hourly_pool_rebuild_job()   → queue=low, every 60 min
    expire_snapshots_job()      → queue=low, every 6 h
"""

from __future__ import annotations

import logging

import django_rq

logger = logging.getLogger(__name__)

_DEFAULT_QUEUE = "default"
_LOW_QUEUE = "low"


def enqueue_post_published(post_id: int) -> None:
    """Non-blocking: run L2 intake for *post_id* in the background."""
    django_rq.get_queue(_DEFAULT_QUEUE).enqueue(
        _run_on_post_published,
        post_id,
        job_timeout=120,
        description=f"L2 intake post={post_id}",
    )


def enqueue_mark_ineligible(post_ids: list[int]) -> None:
    """Non-blocking: bulk-mark *post_ids* as ineligible in the background."""
    django_rq.get_queue(_LOW_QUEUE).enqueue(
        _run_mark_ineligible,
        post_ids,
        job_timeout=60,
        description=f"mark_ineligible posts={post_ids[:5]}…",
    )


def enqueue_mark_author_ineligible(author_id: int) -> None:
    """Non-blocking: mark all posts by *author_id* as ineligible."""
    django_rq.get_queue(_LOW_QUEUE).enqueue(
        _run_mark_author_ineligible,
        author_id,
        job_timeout=120,
        description=f"mark_author_ineligible author={author_id}",
    )


def enqueue_invalidate_user_snapshots(user_id: int) -> None:
    """Non-blocking: deactivate all active snapshots for *user_id*."""
    django_rq.get_queue(_DEFAULT_QUEUE).enqueue(
        _run_invalidate_user_snapshots,
        user_id,
        job_timeout=30,
        description=f"invalidate_snapshots user={user_id}",
    )


def _run_on_post_published(post_id: int) -> None:
    from apps.feed.services.level2_intake import on_post_published
    from apps.posts.models import Post

    try:
        post = Post.objects.select_related("author").prefetch_related("tags").get(pk=post_id)
        on_post_published(post)
    except Post.DoesNotExist:
        logger.warning("_run_on_post_published: post %d not found", post_id)
    except Exception:
        logger.exception("_run_on_post_published: failed for post %d", post_id)
        raise


def _run_mark_ineligible(post_ids: list[int]) -> None:
    from apps.feed.services.level1_pool import mark_ineligible

    mark_ineligible(post_ids)


def _run_mark_author_ineligible(author_id: int) -> None:
    from apps.feed.services.level1_pool import mark_author_posts_ineligible

    mark_author_posts_ineligible(author_id)


def _run_invalidate_user_snapshots(user_id: int) -> None:
    from apps.feed.services.level3_personal import invalidate_user_snapshots

    invalidate_user_snapshots(user_id)


@django_rq.job(_LOW_QUEUE)
def hourly_pool_rebuild_job() -> None:
    """Refresh PostFeedMeta for posts published in the last 25 hours.

    Schedule: every 60 minutes.
    The 25-hour window covers fresh posts plus a 1-hour buffer for the
    previous run, ensuring no published post is ever skipped.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.feed.services.level1_pool import upsert_post_feed_meta
    from apps.posts.models import Post

    cutoff = timezone.now() - timedelta(hours=25)
    qs = (
        Post.objects.filter(status="published", published_at__gte=cutoff)
        .prefetch_related("tags")
        .iterator(chunk_size=200)
    )
    count = 0
    for post in qs:
        try:
            upsert_post_feed_meta(post)
            count += 1
        except Exception:
            logger.exception("hourly_pool_rebuild_job: failed for post %s", post.pk)

    logger.info("hourly_pool_rebuild_job: rebuilt %d PFM records", count)


@django_rq.job(_LOW_QUEUE)
def expire_snapshots_job() -> None:
    """Delete expired inactive FeedSnapshot records older than 48 hours.

    Schedule: every 6 hours.
    Keeps the feed_feedsnapshot table from growing unboundedly.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.feed.models import FeedSnapshot

    cutoff = timezone.now() - timedelta(hours=48)
    deleted, _ = FeedSnapshot.objects.filter(
        is_active=False,
        expires_at__lt=cutoff,
    ).delete()
    logger.info("expire_snapshots_job: deleted %d stale snapshots", deleted)
