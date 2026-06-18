from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import django_rq
from django.utils import timezone

logger = logging.getLogger(__name__)

_DEFAULT = "default"
_LOW = "low"


def _enqueue(queue: str, fn: Callable[..., Any], *args: Any, timeout: int, description: str) -> None:
    django_rq.get_queue(queue).enqueue(fn, *args, job_timeout=timeout, description=description)


def enqueue_post_published(post_id: int) -> None:
    _enqueue(_DEFAULT, _run_on_post_published, post_id, timeout=120, description=f"L2 intake post={post_id}")


def enqueue_mark_ineligible(post_ids: list[int]) -> None:
    _enqueue(_LOW, _run_mark_ineligible, post_ids, timeout=60, description=f"mark_ineligible posts={post_ids[:5]}…")


def enqueue_mark_author_ineligible(author_id: int) -> None:
    _enqueue(_LOW, _run_mark_author_ineligible, author_id, timeout=120, description=f"mark_author_ineligible author={author_id}")


def enqueue_invalidate_user_snapshots(user_id: int) -> None:
    _enqueue(_DEFAULT, _run_invalidate_user_snapshots, user_id, timeout=30, description=f"invalidate_snapshots user={user_id}")


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


@django_rq.job(_LOW)
def hourly_pool_rebuild_job() -> None:
    from apps.feed.services.level1_pool import upsert_post_feed_meta
    from apps.posts.models import Post

    cutoff = timezone.now() - timedelta(hours=25)
    posts = (
        Post.objects.filter(status="published", published_at__gte=cutoff)
        .prefetch_related("tags")
        .iterator(chunk_size=200)
    )

    count = 0
    for post in posts:
        try:
            upsert_post_feed_meta(post)
            count += 1
        except Exception:
            logger.exception("hourly_pool_rebuild_job: failed for post %s", post.pk)

    logger.info("hourly_pool_rebuild_job: rebuilt %d PFM records", count)


@django_rq.job(_LOW)
def expire_snapshots_job() -> None:
    from apps.feed.models import FeedSnapshot

    cutoff = timezone.now() - timedelta(hours=48)
    deleted, _ = FeedSnapshot.objects.filter(is_active=False, expires_at__lt=cutoff).delete()
    logger.info("expire_snapshots_job: deleted %d stale snapshots", deleted)
