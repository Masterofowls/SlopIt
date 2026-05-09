"""Stage 4 tests — DRF serializers and router wiring."""

from __future__ import annotations

import pytest

# ─── Serializer unit tests (no DB) ───────────────────────────────────────────


class TestPostWriteSerializerValidation:
    """Validate PostWriteSerializer field-level rules without a DB."""

    def _make_serializer(self, data: dict):
        from apps.posts.serializers import PostWriteSerializer

        return PostWriteSerializer(data=data)

    def test_text_post_requires_body(self) -> None:
        s = self._make_serializer({"title": "Hello", "kind": "text"})
        assert not s.is_valid()
        assert (
            "body_markdown" in s.errors or "__all__" in s.errors or "non_field_errors" in s.errors
        )

    def test_link_post_requires_link_url(self) -> None:
        s = self._make_serializer({"title": "Hello", "kind": "link"})
        assert not s.is_valid()

    def test_valid_text_post(self) -> None:
        s = self._make_serializer(
            {"title": "Hello World", "kind": "text", "body_markdown": "## Content"}
        )
        assert s.is_valid(), s.errors

    def test_valid_link_post(self) -> None:
        s = self._make_serializer(
            {
                "title": "Interesting link",
                "kind": "link",
                "link_url": "https://example.com",
            }
        )
        assert s.is_valid(), s.errors


class TestPostReadSerializers:
    """Ensure read serializers include related media in API responses."""

    def test_post_list_serializer_has_media_field(self) -> None:
        from apps.posts.serializers import PostListSerializer

        fields = PostListSerializer().get_fields()
        assert "media" in fields

    def test_post_detail_serializer_has_media_field(self) -> None:
        from apps.posts.serializers import PostDetailSerializer

        fields = PostDetailSerializer().get_fields()
        assert "media" in fields


class TestCommentWriteSerializerValidation:
    def test_reply_to_reply_rejected(self) -> None:
        """Replies to replies (depth > 1) should be rejected at serializer level."""
        from unittest.mock import MagicMock

        from apps.comments.serializers import CommentWriteSerializer

        parent = MagicMock()
        parent.parent_id = 99  # non-None → this is already a reply
        parent.post_id = 1

        serializer = CommentWriteSerializer(
            data={"post": 1, "body_markdown": "reply to reply"},
        )
        serializer.initial_data = {"post": 1, "body_markdown": "reply to reply"}

        with pytest.raises(Exception):  # noqa: B017 — DRF raises ValidationError (not ValueError)
            serializer.validate_parent(parent)


class TestReactionToggleSerializer:
    def test_valid_like(self) -> None:
        from apps.reactions.serializers import ReactionToggleSerializer

        s = ReactionToggleSerializer(data={"kind": "like"})
        assert s.is_valid()

    def test_invalid_kind(self) -> None:
        from apps.reactions.serializers import ReactionToggleSerializer

        s = ReactionToggleSerializer(data={"kind": "upvote"})
        assert not s.is_valid()


class TestFeedPreferencesSerializer:
    def test_valid_empty_prefs(self) -> None:
        from apps.feed.serializers import FeedPreferencesSerializer

        s = FeedPreferencesSerializer(
            data={
                "filter_words": [],
                "filter_post_types": [],
                "muted_tag_ids": [],
                "muted_user_ids": [],
            }
        )
        assert s.is_valid(), s.errors

    def test_filter_words_list(self) -> None:
        from apps.feed.serializers import FeedPreferencesSerializer

        s = FeedPreferencesSerializer(
            data={
                "filter_words": ["spam", "casino"],
                "filter_post_types": ["video"],
                "muted_tag_ids": [1, 2, 3],
                "muted_user_ids": [],
            }
        )
        assert s.is_valid(), s.errors


# ─── Pagination unit tests (no DB) ───────────────────────────────────────────


class TestSnapshotIndexPagination:
    def _paginator(self):
        from apps.api.pagination import SnapshotIndexPagination

        return SnapshotIndexPagination()

    def test_first_page(self) -> None:
        pag = self._paginator()
        ids = list(range(100))
        page = pag.paginate(ids, cursor=0, limit=25)
        assert page == list(range(25))

    def test_second_page(self) -> None:
        pag = self._paginator()
        ids = list(range(100))
        page = pag.paginate(ids, cursor=25, limit=25)
        assert page == list(range(25, 50))

    def test_last_page_has_no_next(self) -> None:
        pag = self._paginator()
        ids = list(range(30))
        pag.paginate(ids, cursor=25, limit=25)
        response = pag.get_paginated_response([1, 2, 3, 4, 5])
        assert response.data["has_more"] is False
        assert response.data["next_cursor"] is None

    def test_has_more_when_not_last_page(self) -> None:
        pag = self._paginator()
        ids = list(range(100))
        page = pag.paginate(ids, cursor=0, limit=25)
        response = pag.get_paginated_response(page)
        assert response.data["has_more"] is True
        assert response.data["next_cursor"] == 25

    def test_empty_snapshot(self) -> None:
        pag = self._paginator()
        page = pag.paginate([], cursor=0)
        assert page == []
        response = pag.get_paginated_response([])
        assert response.data["count"] == 0
        assert response.data["has_more"] is False


# ─── Router wiring smoke test (no DB) ────────────────────────────────────────


class TestApiRouter:
    def test_router_url_names_exist(self) -> None:
        """All registered viewsets must appear in the router's URL names."""
        from apps.api.urls import router

        names = [url.name for url in router.urls if hasattr(url, "name")]
        # DefaultRouter generates names like "basename-list", "basename-detail".
        for expected in ("post-list", "tag-list", "comment-list", "feed-list", "me-list"):
            assert expected in names, f"Missing router URL name: {expected}"
