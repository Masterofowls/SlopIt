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


def _pool_version() -> int:
    result = PostFeedMeta.objects.aggregate(v=Max("version"))["v"]
    if result is None:
        return 1
    return result


def _user_prefs(user: AbstractBaseUser) -> FeedPreferences:
    prefs, _created = FeedPreferences.objects.get_or_create(user=user)
    return prefs


def _snapshot_lifetime_hours(user: AbstractBaseUser) -> int:
    profile = getattr(user, "profile", None)
    if profile is not None:
        hours = getattr(profile, "feed_lifetime_hours", None)
        if hours is not None:
            return hours

    default_hours = getattr(settings, "FEED_DEFAULT_LIFETIME_HOURS", 10)
    return default_hours


def _eligible_posts(prefs: FeedPreferences):
    qs = PostFeedMeta.objects.filter(is_eligible=True)

    if len(prefs.filter_post_types) > 0:
        qs = qs.exclude(kind__in=prefs.filter_post_types)

    if len(prefs.filter_words) > 0:
        word_query = SearchQuery(prefs.filter_words[0], search_type="plain")
        for word in prefs.filter_words[1:]:
            next_query = SearchQuery(word, search_type="plain")
            word_query = word_query | next_query
        qs = qs.exclude(keyword_set=word_query)

    if len(prefs.muted_tag_ids) > 0:
        qs = qs.exclude(tag_ids__overlap=prefs.muted_tag_ids)

    if len(prefs.muted_user_ids) > 0:
        qs = qs.exclude(post__author_id__in=prefs.muted_user_ids)

    return qs


def _shuffle_no_consecutive_authors(
    rows: list[tuple[int, int]],
    rng: random.Random,
) -> list[int]:
    if len(rows) == 0:
        return []

    pool = list(rows)
    rng.shuffle(pool)
    ordered = []

    while len(pool) > 0:
        if len(ordered) == 0:
            last_author = None
        else:
            last_author = ordered[-1][1]

        pick = 0
        for i in range(len(pool)):
            post_id, author_id = pool[i]
            if author_id != last_author:
                pick = i
                break

        item = pool.pop(pick)
        ordered.append(item)

    post_ids = []
    for post_id, author_id in ordered:
        post_ids.append(post_id)

    return post_ids


def get_or_create_snapshot(user: AbstractBaseUser) -> FeedSnapshot:
    now = timezone.now()
    snapshot = (
        FeedSnapshot.objects.filter(user=user, is_active=True, expires_at__gt=now)
        .order_by("-created_at")
        .first()
    )

    if snapshot is None:
        return force_new_snapshot(user)

    pool_version = _pool_version()
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
    FeedSnapshot.objects.filter(user=user, is_active=True).update(is_active=False)

    prefs = _user_prefs(user)
    seed = secrets.randbelow(2**63)
    rng = random.Random(seed)  # noqa: S311

    rows = list(_eligible_posts(prefs).values_list("post_id", "post__author_id"))
    post_ids = _shuffle_no_consecutive_authors(rows, rng)
    lifetime = _snapshot_lifetime_hours(user)
    pool_version = _pool_version()
    expires_at = timezone.now() + timedelta(hours=lifetime)

    snapshot = FeedSnapshot.objects.create(
        user=user,
        seed=seed,
        post_ids=post_ids,
        expires_at=expires_at,
        version=pool_version,
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
    updated = FeedSnapshot.objects.filter(user_id=user_id, is_active=True).update(is_active=False)
    logger.info("invalidate_user_snapshots: user=%d, deactivated=%d", user_id, updated)
    return updated
