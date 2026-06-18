from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.contrib.postgres.search import SearchVector
from django.db import transaction
from django.db.models import Value
from django.utils import timezone

from apps.feed.models import PostFeedMeta
from apps.feed.services.common import ROTATION_MODULO, post_content_hash, stable_hash

if TYPE_CHECKING:
    from apps.posts.models import Post

logger = logging.getLogger(__name__)


def _keyword_vector(title: str, body: str) -> SearchVector:
    title_part = SearchVector(Value(title), weight="A", config="english")
    body_part = SearchVector(Value(body), weight="B", config="english")
    return title_part + body_part


@transaction.atomic
def upsert_post_feed_meta(post: Post) -> PostFeedMeta:
    from apps.feed.services.level2_intake import assign_bucket

    content_hash = post_content_hash(post)
    tag_ids = list(post.tags.values_list("id", flat=True))

    if post.status == "published":
        is_eligible = True
    else:
        is_eligible = False

    if post.published_at:
        published_at = post.published_at
    else:
        published_at = timezone.now()

    pfm, created = PostFeedMeta.objects.get_or_create(
        post=post,
        defaults={
            "content_hash": content_hash,
            "kind": post.kind,
            "tag_ids": tag_ids,
            "rotation_offset": stable_hash(post.pk) % ROTATION_MODULO,
            "published_at": published_at,
            "is_eligible": is_eligible,
            "bucket": assign_bucket(post, content_hash),
        },
    )

    if not created:
        pfm.content_hash = content_hash
        pfm.kind = post.kind
        pfm.tag_ids = tag_ids
        if post.published_at:
            pfm.published_at = post.published_at
        pfm.is_eligible = is_eligible
        pfm.version = pfm.version + 1
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

    keywords = _keyword_vector(post.title, post.body_markdown)
    PostFeedMeta.objects.filter(pk=pfm.pk).update(keyword_set=keywords)
    return pfm


def initialize_system_feed() -> int:
    from apps.posts.models import Post

    count = 0
    posts = Post.objects.filter(status="published").prefetch_related("tags").iterator(chunk_size=500)

    for post in posts:
        try:
            upsert_post_feed_meta(post)
            count = count + 1
        except Exception:
            logger.exception("initialize_system_feed: failed for post pk=%s", post.pk)

    logger.info("initialize_system_feed: processed %d posts", count)
    return count


def mark_ineligible(post_ids: list[int]) -> int:
    updated = PostFeedMeta.objects.filter(post_id__in=post_ids).update(is_eligible=False)
    logger.info("mark_ineligible: marked %d PFM records", updated)
    return updated


def mark_author_posts_ineligible(author_id: int) -> int:
    updated = PostFeedMeta.objects.filter(post__author_id=author_id).update(is_eligible=False)
    logger.info("mark_author_posts_ineligible: author=%d, records=%d", author_id, updated)
    return updated
