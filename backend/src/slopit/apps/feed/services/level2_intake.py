from __future__ import annotations

import logging
import random
from typing import TYPE_CHECKING

from django.utils import timezone

from apps.feed.models import PostFeedMeta
from apps.feed.services.common import (
    BUCKET_COUNT,
    BURST_WINDOW_SECONDS,
    NEIGHBOR_RANGE,
    post_content_hash,
    stable_hash,
)
from apps.feed.simhash import NEAR_DUPLICATE_THRESHOLD, hamming_distance, is_near_duplicate

if TYPE_CHECKING:
    from apps.posts.models import Post

logger = logging.getLogger(__name__)


def _bucket_candidates(post_id: int) -> list[int]:
    rng = random.Random(stable_hash(post_id))  # noqa: S311
    candidates = []
    for bucket in range(BUCKET_COUNT):
        candidates.append(bucket)
    rng.shuffle(candidates)
    return candidates


def assign_bucket(post: Post, content_hash: str) -> int:
    if post.published_at:
        published_at = post.published_at
    else:
        published_at = timezone.now()

    candidates = _bucket_candidates(post.pk)

    for bucket in candidates:
        start = bucket - NEIGHBOR_RANGE
        if start < 0:
            start = 0

        end = bucket + NEIGHBOR_RANGE
        if end > BUCKET_COUNT - 1:
            end = BUCKET_COUNT - 1

        neighbor_buckets = []
        for b in range(start, end + 1):
            neighbor_buckets.append(b)

        neighbors = PostFeedMeta.objects.filter(
            bucket__in=neighbor_buckets,
            is_eligible=True,
        ).values_list("post__author_id", "content_hash", "published_at")

        blocked = False
        for nb_author_id, nb_hash, nb_pub in neighbors:
            if nb_author_id == post.author_id:
                blocked = True
                break

            distance = hamming_distance(content_hash, nb_hash)
            if distance < NEAR_DUPLICATE_THRESHOLD:
                blocked = True
                break

            if nb_pub is not None:
                delta = abs((published_at - nb_pub).total_seconds())
                if delta < BURST_WINDOW_SECONDS:
                    blocked = True
                    break

        if blocked:
            continue

        return bucket

    logger.warning(
        "assign_bucket: all buckets blocked for post %s — using fallback",
        post.pk,
    )
    return candidates[0]


def find_near_duplicates(content_hash: str) -> list[int]:
    results = []
    rows = PostFeedMeta.objects.values_list("post_id", "content_hash")

    for post_id, existing_hash in rows:
        if is_near_duplicate(content_hash, existing_hash):
            results.append(post_id)

    return results


def on_post_published(post: Post) -> PostFeedMeta:
    from apps.feed.services.level1_pool import upsert_post_feed_meta

    content_hash = post_content_hash(post)
    near_dups = find_near_duplicates(content_hash)

    if len(near_dups) > 0:
        logger.warning(
            "on_post_published: post %s appears to be a near-duplicate of %s",
            post.pk,
            near_dups[:5],
        )

    pfm = upsert_post_feed_meta(post)
    logger.info(
        "on_post_published: post=%s bucket=%d rotation=%d",
        post.pk,
        pfm.bucket,
        pfm.rotation_offset,
    )
    return pfm
