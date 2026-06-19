"""Feed maintenance tasks — run synchronously (no background queue)."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


def run_on_post_published(post_id: int) -> None:
    from apps.feed.services.level2_intake import on_post_published
    from apps.posts.models import Post

    try:
        post = Post.objects.select_related("author").prefetch_related("tags").get(pk=post_id)
        on_post_published(post)
    except Post.DoesNotExist:
        logger.warning("run_on_post_published: post %d not found", post_id)
    except Exception:
        logger.exception("run_on_post_published: failed for post %d", post_id)
        raise


def run_mark_ineligible(post_ids: list[int]) -> int:
    from apps.feed.services.level1_pool import mark_ineligible

    return mark_ineligible(post_ids)


def run_mark_author_ineligible(author_id: int) -> int:
    from apps.feed.services.level1_pool import mark_author_posts_ineligible

    return mark_author_posts_ineligible(author_id)


def run_invalidate_user_snapshots(user_id: int) -> int:
    from apps.feed.services.level3_personal import invalidate_user_snapshots

    return invalidate_user_snapshots(user_id)


def hourly_pool_rebuild_job() -> int:
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
    return count


def expire_snapshots_job() -> int:
    from apps.feed.models import FeedSnapshot

    cutoff = timezone.now() - timedelta(hours=48)
    deleted, _ = FeedSnapshot.objects.filter(is_active=False, expires_at__lt=cutoff).delete()
    logger.info("expire_snapshots_job: deleted %d stale snapshots", deleted)
    return deleted
