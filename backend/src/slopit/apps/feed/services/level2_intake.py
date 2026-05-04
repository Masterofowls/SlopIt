"""Level 2: New-content intake pipeline.

Called when a post is published for the first time. Responsibilities:

1. Compute SimHash (content_hash) from title + body.
2. Detect near-duplicates (Hamming distance < 4) and log a warning.
3. Pick an anti-clustering bucket that avoids placing the post next to:
   - Posts from the same author.
   - Posts with similar content (near-dup by SimHash).
   - Posts published within ±5 minutes (anti-burst).
4. Compute rotation_offset = stable_hash(post.id) % 1024.
5. Upsert PostFeedMeta via L1.

Public API:
    on_post_published(post) -> PostFeedMeta
    assign_bucket(post, content_hash) -> int   (also called by L1 bootstrap)
    find_near_duplicates(content_hash) -> list[int]
"""

from __future__ import annotations

import hashlib
import logging
import random
import struct
from typing import TYPE_CHECKING

from django.conf import settings
from django.utils import timezone

from apps.feed.models import PostFeedMeta
from apps.feed.simhash import compute as simhash_compute
from apps.feed.simhash import hamming_distance

if TYPE_CHECKING:
    from apps.posts.models import Post

logger = logging.getLogger(__name__)

_BUCKET_COUNT: int = getattr(settings, "FEED_BUCKET_COUNT", 256)
_NEAR_DUPLICATE_THRESHOLD = 4
_BURST_WINDOW_SECONDS = 5 * 60
_NEIGHBOR_RANGE = 1




def _stable_hash(value: int) -> int:
    """Deterministic 64-bit hash of an integer (immune to PYTHONHASHSEED)."""
    digest = hashlib.md5(struct.pack(">q", value), usedforsecurity=False).digest()
    return struct.unpack(">Q", digest[:8])[0]


def _candidate_order(post_id: int) -> list[int]:
    """Return buckets 0..B-1 in a deterministic post-specific order."""
    rng = random.Random(_stable_hash(post_id))  # noqa: S311
    candidates = list(range(_BUCKET_COUNT))
    rng.shuffle(candidates)
    return candidates


def _violates_constraints(
    bucket: int,
    author_id: int,
    content_hash: str,
    published_at: object,
) -> bool:
    """Return True if placing a post in *bucket* breaks anti-clustering rules."""
    neighbor_buckets = range(
        max(0, bucket - _NEIGHBOR_RANGE),
        min(_BUCKET_COUNT - 1, bucket + _NEIGHBOR_RANGE) + 1,
    )
    neighbors = PostFeedMeta.objects.filter(
        bucket__in=neighbor_buckets, is_eligible=True
    ).values_list("post__author_id", "content_hash", "published_at")

    for nb_author_id, nb_hash, nb_pub in neighbors:
        if nb_author_id == author_id:
            return True
        if hamming_distance(content_hash, nb_hash) < _NEAR_DUPLICATE_THRESHOLD:
            return True
        if nb_pub is not None:
            delta = abs((published_at - nb_pub).total_seconds())
            if delta < _BURST_WINDOW_SECONDS:
                return True
    return False




def assign_bucket(post: Post, content_hash: str) -> int:
    """Pick the best anti-clustering bucket for *post*.

    Iterates a deterministic candidate order; returns the first bucket that
    satisfies all constraints, or the first candidate as a fallback.
    """
    published_at = post.published_at or timezone.now()
    candidates = _candidate_order(post.pk)

    for bucket in candidates:
        if not _violates_constraints(bucket, post.author_id, content_hash, published_at):
            return bucket

    logger.warning(
        "assign_bucket: all buckets violate constraints for post %s — using fallback",
        post.pk,
    )
    return candidates[0]


def find_near_duplicates(content_hash: str) -> list[int]:
    """Return post IDs of PFM records that are near-duplicates of *content_hash*.

    Fetches all (post_id, content_hash) pairs and compares in Python.
    At 100k posts this is < 50 ms (spec §7); at larger scale, use a PG
    extension or LSH index.
    """
    results = []
    for post_id, existing_hash in PostFeedMeta.objects.values_list("post_id", "content_hash"):
        if hamming_distance(content_hash, existing_hash) < _NEAR_DUPLICATE_THRESHOLD:
            results.append(post_id)
    return results


def on_post_published(post: Post) -> PostFeedMeta:
    """Main L2 entry point: intake a newly published post into the system feed.

    Steps:
    1. Compute content_hash.
    2. Log a warning for near-duplicates (moderation is handled separately).
    3. Assign anti-clustering bucket.
    4. Upsert PostFeedMeta via L1.
    """
    from apps.feed.services.level1_pool import upsert_post_feed_meta

    content_hash = simhash_compute(f"{post.title} {post.body_markdown}")

    near_dups = find_near_duplicates(content_hash)
    if near_dups:
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
