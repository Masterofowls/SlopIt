"""Level 3: Per-user feed snapshot generation.

Generates a deterministic, reproducible FeedSnapshot for a user:

1. Apply the user's FeedPreferences to filter the eligible PostFeedMeta pool.
2. Group filtered posts by bucket (anti-clustering groupings from L2).
3. Generate a fresh cryptographic seed (secrets.randbits).
4. Within each bucket, sort by (rotation_offset XOR seed_low32).
5. Shuffle bucket order with the seed.
6. Round-robin across buckets to produce the final ordered post_ids list.
7. Persist in a new FeedSnapshot; deactivate any prior active snapshot.

Public API:
    get_or_create_snapshot(user) -> FeedSnapshot
    force_new_snapshot(user)     -> FeedSnapshot
    invalidate_user_snapshots(user_id) -> int
"""

from __future__ import annotations

import logging
import random
import secrets
from collections import defaultdict
from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.postgres.search import SearchQuery
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.feed.models import FeedPreferences, FeedSnapshot, PostFeedMeta

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

logger = logging.getLogger(__name__)




def _current_pool_version() -> int:
    """Return the maximum PostFeedMeta version (tracks pool freshness)."""
    result = PostFeedMeta.objects.aggregate(v=Max("version"))["v"]
    return result or 1


def _get_prefs(user: AbstractBaseUser) -> FeedPreferences:
    """Return the user's FeedPreferences, creating defaults if missing."""
    prefs, _ = FeedPreferences.objects.get_or_create(user=user)
    return prefs


def _build_ordered_ids(
    rows: list[tuple[int, int, int]],
    seed: int,
) -> list[int]:
    """Convert (post_id, bucket, rotation_offset) rows to an ordered list.

    Algorithm (spec §5.2):
    1. Group by bucket.
    2. Within each bucket, sort by (rotation_offset XOR low32(seed)).
    3. Shuffle bucket order with RNG seeded by `seed`.
    4. Round-robin: take one item from each bucket in turn.

    Time: O(n log n).  Space: O(n).
    """
    if not rows:
        return []

    by_bucket: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for post_id, bucket, rotation_offset in rows:
        by_bucket[bucket].append((post_id, rotation_offset))

    low32 = seed & 0xFFFF_FFFF
    for items in by_bucket.values():
        items.sort(key=lambda x: x[1] ^ low32)

    rng = random.Random(seed)  # noqa: S311
    bucket_keys = list(by_bucket.keys())
    rng.shuffle(bucket_keys)

    ordered: list[int] = []
    lists = [by_bucket[b] for b in bucket_keys]
    max_len = max(len(lst) for lst in lists)
    for i in range(max_len):
        for lst in lists:
            if i < len(lst):
                ordered.append(lst[i][0])

    return ordered




def get_or_create_snapshot(user: AbstractBaseUser) -> FeedSnapshot:
    """Return the current active snapshot, or generate a new one.

    A new snapshot is generated when:
    - No active snapshot exists for the user.
    - The active snapshot is expired (now > expires_at).
    - The snapshot's version is behind the current pool version.
    """
    now = timezone.now()
    snapshot = (
        FeedSnapshot.objects.filter(user=user, is_active=True, expires_at__gt=now)
        .order_by("-created_at")
        .first()
    )
    if snapshot:
        pool_version = _current_pool_version()
        if snapshot.version >= pool_version:
            return snapshot
        logger.info(
            "get_or_create_snapshot: stale v%d vs pool v%d for user %s — rebuilding",
            snapshot.version,
            pool_version,
            user.pk,
        )
    return force_new_snapshot(user)


@transaction.atomic
def force_new_snapshot(user: AbstractBaseUser) -> FeedSnapshot:
    """Unconditionally generate a fresh FeedSnapshot for *user*.

    Deactivates all existing active snapshots first so only one is ever active.
    """
    FeedSnapshot.objects.filter(user=user, is_active=True).update(is_active=False)

    prefs = _get_prefs(user)

    seed = secrets.randbelow(2**63)

    qs = PostFeedMeta.objects.filter(is_eligible=True)

    if prefs.filter_post_types:
        qs = qs.exclude(kind__in=prefs.filter_post_types)

    if prefs.filter_words:
        queries = [SearchQuery(w, search_type="plain") for w in prefs.filter_words]
        combined = queries[0]
        for q in queries[1:]:
            combined = combined | q
        qs = qs.exclude(keyword_set=combined)

    if prefs.muted_tag_ids:
        qs = qs.exclude(tag_ids__overlap=prefs.muted_tag_ids)

    if prefs.muted_user_ids:
        qs = qs.exclude(post__author_id__in=prefs.muted_user_ids)

    rows = list(qs.values_list("post_id", "bucket", "rotation_offset"))

    post_ids = _build_ordered_ids(rows, seed)

    lifetime_hours: int | None = None
    profile = getattr(user, "profile", None)
    if profile is not None:
        lifetime_hours = getattr(profile, "feed_lifetime_hours", None)
    if lifetime_hours is None:
        lifetime_hours = getattr(settings, "FEED_DEFAULT_LIFETIME_HOURS", 10)

    snapshot = FeedSnapshot.objects.create(
        user=user,
        seed=seed,
        post_ids=post_ids,
        expires_at=timezone.now() + timedelta(hours=lifetime_hours),
        version=_current_pool_version(),
    )
    logger.info(
        "force_new_snapshot: user=%s posts=%d seed=%d expires=%s",
        user.pk,
        len(post_ids),
        seed,
        snapshot.expires_at.isoformat(),
    )
    return snapshot


def invalidate_user_snapshots(user_id: int) -> int:
    """Deactivate all active snapshots for *user_id*.

    Called when:
    - User updates their FeedPreferences.
    - User is banned or unbanned.
    The next request to get_or_create_snapshot will trigger a fresh generation.
    """
    updated = FeedSnapshot.objects.filter(user_id=user_id, is_active=True).update(is_active=False)
    logger.info("invalidate_user_snapshots: user=%d, deactivated=%d", user_id, updated)
    return updated
