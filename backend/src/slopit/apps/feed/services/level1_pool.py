"""Level 1: System feed pool — build and maintain the PostFeedMeta index.

Provides helpers for creating/refreshing PostFeedMeta records from published
posts.  This is the source of truth for which posts are eligible to appear in
any user's feed.

Public API:
    upsert_post_feed_meta(post) -> PostFeedMeta
    initialize_system_feed()    -> int
    mark_ineligible(post_ids)   -> int
    mark_author_posts_ineligible(author_id) -> int
"""

from __future__ import annotations

import hashlib
import logging
import struct
from typing import TYPE_CHECKING

from django.contrib.postgres.search import SearchVector
from django.db import transaction
from django.db.models import Value
from django.utils import timezone

from apps.feed.models import PostFeedMeta
from apps.feed.simhash import compute as simhash_compute

if TYPE_CHECKING:
    from apps.posts.models import Post

logger = logging.getLogger(__name__)


def _stable_hash(value: int) -> int:
    """Deterministic 64-bit hash of an integer (immune to PYTHONHASHSEED)."""
    digest = hashlib.md5(struct.pack(">q", value), usedforsecurity=False).digest()
    return struct.unpack(">Q", digest[:8])[0]


def _content_hash(post: Post) -> str:
    return simhash_compute(f"{post.title} {post.body_markdown}")


def _keyword_vector(title: str, body: str) -> SearchVector:
    """Weighted tsvector expression for a post's title + body."""
    return SearchVector(Value(title), weight="A", config="english") + SearchVector(
        Value(body), weight="B", config="english"
    )


@transaction.atomic
def upsert_post_feed_meta(post: Post) -> PostFeedMeta:
    """Create or refresh the PostFeedMeta record for *post*.

    On *create*: assign anti-clustering bucket via L2.
    On *update*: refresh hash, tags, eligibility; preserve existing bucket/offset.
    """
    from apps.feed.services.level2_intake import assign_bucket

    content_hash = _content_hash(post)
    tag_ids = list(post.tags.values_list("id", flat=True))
    is_eligible = post.status == "published"

    pfm, created = PostFeedMeta.objects.get_or_create(
        post=post,
        defaults={
            "content_hash": content_hash,
            "kind": post.kind,
            "tag_ids": tag_ids,
            "rotation_offset": _stable_hash(post.pk) % 1024,
            "published_at": post.published_at or timezone.now(),
            "is_eligible": is_eligible,
            "bucket": assign_bucket(post, content_hash),
        },
    )

    if not created:
        pfm.content_hash = content_hash
        pfm.kind = post.kind
        pfm.tag_ids = tag_ids
        pfm.published_at = post.published_at or pfm.published_at
        pfm.is_eligible = is_eligible
        pfm.version += 1
        pfm.save(
            update_fields=[
                "content_hash",
                "kind",
                "tag_ids",
                "published_at",
                "is_eligible",
                "version",
            ]
        )

    PostFeedMeta.objects.filter(pk=pfm.pk).update(
        keyword_set=_keyword_vector(post.title, post.body_markdown)
    )
    return pfm


def initialize_system_feed() -> int:
    """Bootstrap PostFeedMeta for every published post (one-shot).

    Returns the number of posts successfully processed.
    Typically run once on initial deployment or after a hard reset.
    """
    from apps.posts.models import Post

    count = 0
    qs = Post.objects.filter(status="published").prefetch_related("tags").iterator(chunk_size=500)
    for post in qs:
        try:
            upsert_post_feed_meta(post)
            count += 1
        except Exception:
            logger.exception("initialize_system_feed: failed for post pk=%s", post.pk)

    logger.info("initialize_system_feed: processed %d posts", count)
    return count


def mark_ineligible(post_ids: list[int]) -> int:
    """Bulk-mark post IDs as ineligible (removed / moderated)."""
    updated = PostFeedMeta.objects.filter(post_id__in=post_ids).update(is_eligible=False)
    logger.info("mark_ineligible: marked %d PFM records", updated)
    return updated


def mark_author_posts_ineligible(author_id: int) -> int:
    """Mark all PFM records for a banned author as ineligible."""
    updated = PostFeedMeta.objects.filter(post__author_id=author_id).update(is_eligible=False)
    logger.info("mark_author_posts_ineligible: author=%d, records=%d", author_id, updated)
    return updated
