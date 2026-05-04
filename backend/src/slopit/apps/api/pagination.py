"""Custom pagination classes for SlopIt API."""

from __future__ import annotations

from django.conf import settings
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsPagination(PageNumberPagination):
    """Standard cursor-free pagination for lists (posts, comments, tags)."""

    page_size = 25
    page_size_query_param = "limit"
    max_page_size = 100


class SnapshotIndexPagination:
    """Index-based pagination for the feed snapshot.

    The feed snapshot stores an ordered list of post IDs (``post_ids``).
    Pagination works by slicing this list:
        ``snapshot.post_ids[cursor : cursor + page_size]``

    Query params:
        cursor (int, default 0): start index in the snapshot array.
        limit  (int, default FEED_PAGE_SIZE): number of posts per page.

    Response shape:
        {
            "count":       <total posts in snapshot>,
            "next_cursor": <int | null>,
            "has_more":    <bool>,
            "results":     [...]
        }
    """

    def __init__(self) -> None:
        self.page_size: int = getattr(settings, "FEED_PAGE_SIZE", 25)
        self.cursor: int = 0
        self.total: int = 0

    def paginate(
        self,
        post_ids: list[int],
        cursor: int,
        limit: int | None = None,
    ) -> list[int]:
        page_size = min(limit or self.page_size, 100)
        self.cursor = cursor
        self.total = len(post_ids)
        self.page_size = page_size
        return post_ids[cursor : cursor + page_size]

    def get_paginated_response(self, data: list[object]) -> Response:
        end = self.cursor + len(data)
        has_more = end < self.total
        return Response(
            {
                "count": self.total,
                "next_cursor": end if has_more else None,
                "has_more": has_more,
                "results": data,
            }
        )
