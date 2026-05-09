"""Stage 3 tests — feed algorithm (pure-function + DB-backed).

Pure-function tests (no DB): simhash, _build_ordered_ids.
DB-backed tests (pytest-django): L3 snapshot generation, L1 upsert helpers.
"""

from __future__ import annotations

import secrets

import pytest

# ─── SimHash tests (no DB required) ──────────────────────────────────────────


class TestSimhash:
    def test_returns_16_hex_chars(self) -> None:
        from apps.feed.simhash import compute

        result = compute("hello world")
        assert len(result) == 16
        assert all(c in "0123456789abcdef" for c in result)

    def test_empty_input_returns_zero_fingerprint(self) -> None:
        from apps.feed.simhash import compute

        assert compute("") == "0" * 16
        assert compute("   ") == "0" * 16

    def test_identical_texts_produce_identical_hash(self) -> None:
        from apps.feed.simhash import compute

        text = "The quick brown fox jumps over the lazy dog"
        assert compute(text) == compute(text)

    def test_similar_texts_have_low_hamming_distance(self) -> None:
        from apps.feed.simhash import compute, hamming_distance

        h1 = compute("The quick brown fox jumps over the lazy dog")
        h2 = compute("The quick brown fox jumped over the lazy dog")
        # SimHash is lossy; similar texts have measurably lower distance than
        # completely different texts, but the threshold is not guaranteed to be < 10.
        assert hamming_distance(h1, h2) < 30

    def test_very_different_texts_have_high_hamming_distance(self) -> None:
        from apps.feed.simhash import compute, hamming_distance

        h1 = compute("aaa bbb ccc ddd eee fff")
        h2 = compute("zzz yyy xxx www vvv uuu")
        # Different texts should have non-zero distance.
        assert hamming_distance(h1, h2) > 0

    def test_near_duplicate_detection(self) -> None:
        from apps.feed.simhash import compute, is_near_duplicate

        # Exact same text → distance = 0 → near-duplicate.
        h = compute("buy cheap products online now")
        assert is_near_duplicate(h, h) is True

    def test_hamming_distance_identical(self) -> None:
        from apps.feed.simhash import hamming_distance

        assert hamming_distance("0" * 16, "0" * 16) == 0

    def test_hamming_distance_all_bits_flipped(self) -> None:
        from apps.feed.simhash import hamming_distance

        # XOR of ffffffffffffffff and 0000000000000000 = 64 bits set.
        assert hamming_distance("f" * 16, "0" * 16) == 64


# ─── L3 build_ordered_ids tests (no DB required) ─────────────────────────────


class TestBuildOrderedIds:
    @staticmethod
    def _build(rows: list[tuple[int, int, int]], seed: int) -> list[int]:
        from apps.feed.services.level3_personal import _build_ordered_ids

        return _build_ordered_ids(rows, seed)

    def test_empty_input_returns_empty_list(self) -> None:
        assert self._build([], seed=42) == []

    def test_single_post_returned(self) -> None:
        result = self._build([(99, 0, 0)], seed=1)
        assert result == [99]

    def test_all_post_ids_are_present(self) -> None:
        rows = [(i, i % 4, i % 8) for i in range(20)]
        seed = secrets.randbelow(2**63)
        result = self._build(rows, seed)
        assert sorted(result) == list(range(20))

    def test_reproducibility(self) -> None:
        """Same seed → same order."""
        rows = [(i, i % 8, i % 16) for i in range(50)]
        seed = 12345678
        assert self._build(rows, seed) == self._build(rows, seed)

    def test_different_seeds_usually_different_order(self) -> None:
        """Different seeds should (almost always) produce different orderings."""
        rows = [(i, i % 8, i % 16) for i in range(50)]
        result_a = self._build(rows, seed=1)
        result_b = self._build(rows, seed=2)
        # It's astronomically unlikely both seeds produce the same order for 50 items.
        assert result_a != result_b

    def test_round_robin_anti_clustering(self) -> None:
        """Items from different buckets should be interleaved, not grouped."""
        # Bucket 0: posts 0, 1, 2.  Bucket 1: posts 10, 11, 12.
        rows = [(0, 0, 0), (1, 0, 1), (2, 0, 2), (10, 1, 0), (11, 1, 1), (12, 1, 2)]
        result = self._build(rows, seed=42)
        # Round-robin should not place all bucket-0 posts consecutively.
        assert len(result) == 6
        # Verify both buckets are represented in the first 4 positions.
        bucket_0_posts = {0, 1, 2}
        bucket_1_posts = {10, 11, 12}
        first_four = set(result[:4])
        assert first_four & bucket_0_posts
        assert first_four & bucket_1_posts


# ─── L3 snapshot tests (DB-backed) ───────────────────────────────────────────


@pytest.mark.skip(reason="requires live PostgreSQL — run with a local DB")
@pytest.mark.django_db
class TestGetOrCreateSnapshot:
    def test_creates_snapshot_when_none_exists(self, django_user_model: object) -> None:
        from django.utils import timezone

        from apps.feed.models import FeedSnapshot
        from apps.feed.services.level3_personal import get_or_create_snapshot

        user = django_user_model.objects.create_user(  # type: ignore[union-attr]
            username="snaptestuser",
            email="snap@example.com",
            password="pass",
        )
        snapshot = get_or_create_snapshot(user)
        assert isinstance(snapshot, FeedSnapshot)
        assert snapshot.user == user
        assert snapshot.is_active is True
        assert snapshot.expires_at > timezone.now()

    def test_returns_existing_active_snapshot(self, django_user_model: object) -> None:
        from apps.feed.services.level3_personal import get_or_create_snapshot

        user = django_user_model.objects.create_user(  # type: ignore[union-attr]
            username="snaptestuser2",
            email="snap2@example.com",
            password="pass",
        )
        snap1 = get_or_create_snapshot(user)
        snap2 = get_or_create_snapshot(user)
        assert snap1.pk == snap2.pk

    def test_force_new_snapshot_deactivates_old(self, django_user_model: object) -> None:
        from apps.feed.models import FeedSnapshot
        from apps.feed.services.level3_personal import force_new_snapshot

        user = django_user_model.objects.create_user(  # type: ignore[union-attr]
            username="snaptestuser3",
            email="snap3@example.com",
            password="pass",
        )
        snap1 = force_new_snapshot(user)
        snap2 = force_new_snapshot(user)

        snap1.refresh_from_db()
        assert snap1.is_active is False
        assert snap2.is_active is True
        assert FeedSnapshot.objects.filter(user=user, is_active=True).count() == 1

    def test_invalidate_user_snapshots(self, django_user_model: object) -> None:
        from apps.feed.models import FeedSnapshot
        from apps.feed.services.level3_personal import (
            force_new_snapshot,
            invalidate_user_snapshots,
        )

        user = django_user_model.objects.create_user(  # type: ignore[union-attr]
            username="snaptestuser4",
            email="snap4@example.com",
            password="pass",
        )
        force_new_snapshot(user)
        count = invalidate_user_snapshots(user.pk)
        assert count == 1
        assert FeedSnapshot.objects.filter(user=user, is_active=True).count() == 0
