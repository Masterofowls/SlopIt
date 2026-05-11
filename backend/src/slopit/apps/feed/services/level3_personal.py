"""Level 3: Per-user feed snapshot generation.

Algorithm:
1. Apply the user's FeedPreferences to filter the eligible PostFeedMeta pool.
2. Generate a fresh cryptographic seed via secrets.randbelow.
3. Shuffle all eligible posts randomly (no ranking by likes/time/type).
4. Reorder to prevent two consecutive posts from the same author.
5. Persist in a new FeedSnapshot; deactivate any prior active snapshot.

Public API:
    get_or_create_snapshot(user) -> FeedSnapshot
    force_new_snapshot(user)     -> FeedSnapshot
    invalidate_user_snapshots(user_id) -> int
"""

from __future__ import annotations

import logging
import random
import secrets
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


def _shuffle_no_consecutive_authors(
    rows: list[tuple[int, int]],
    rng: random.Random,
) -> list[int]:
    """Randomly shuffle (post_id, author_id) pairs then reorder so no two
    consecutive posts share the same author.

    Uses a greedy forward-scan: when a violation is detected at position i,
    finds the next post j > i with a different author and swaps them.
    Falls back gracefully when all remaining posts share the same author
    (impossible to avoid consecutive — just appends them in order).

    Time: O(n²) worst-case, O(n) typical. Fine for feed sizes up to ~10k.
    """
    if not rows:
        return []

    items = list(rows)
    rng.shuffle(items)

    result: list[tuple[int, int]] = []
    remaining = items

    while remaining:
        last_author = result[-1][1] if result else None

        # Find the first item that doesn't repeat the last author
        idx = 0
        for i, (_, author_id) in enumerate(remaining):
            if author_id != last_author:
                idx = i
                break

        result.append(remaining[idx])
        remaining = remaining[:idx] + remaining[idx + 1 :]

    return [post_id for post_id, _ in result]


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
    rng = random.Random(seed)  # noqa: S311

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

    rows = list(qs.values_list("post_id", "post__author_id"))

    post_ids = _shuffle_no_consecutive_authors(rows, rng)

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
