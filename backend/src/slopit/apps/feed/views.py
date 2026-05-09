"""API views for the 3-level feed algorithm."""

from __future__ import annotations

from typing import TYPE_CHECKING

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

if TYPE_CHECKING:
    from rest_framework.request import Request

from django.db.models import F

from apps.api.pagination import SnapshotIndexPagination
from apps.feed.services.level3_personal import force_new_snapshot, get_or_create_snapshot
from apps.posts.models import Post, PostView
from apps.posts.serializers import PostListSerializer


class FeedViewSet(GenericViewSet):
    """Per-user randomised feed backed by FeedSnapshot.

    Routes:
        GET  /api/v1/feed/          → paginated feed for the current user
        POST /api/v1/feed/refresh/  → force a fresh snapshot (new seed)
    """

    permission_classes = [IsAuthenticated]
    serializer_class = PostListSerializer
    pagination_class = None

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "cursor",
                int,
                location=OpenApiParameter.QUERY,
                description="Start index in the snapshot (default 0).",
            ),
            OpenApiParameter(
                "limit",
                int,
                location=OpenApiParameter.QUERY,
                description="Number of posts per page (default 25, max 100).",
            ),
        ],
    )
    def list(self, request: Request) -> Response:
        """GET /api/v1/feed/ — return the user's current feed page."""
        snapshot = get_or_create_snapshot(request.user)

        try:
            cursor = max(0, int(request.query_params.get("cursor", 0)))
        except (TypeError, ValueError):
            cursor = 0

        try:
            limit = max(1, min(100, int(request.query_params.get("limit", 25))))
        except (TypeError, ValueError):
            limit = 25

        paginator = SnapshotIndexPagination()
        page_ids = paginator.paginate(snapshot.post_ids, cursor, limit)

        if not page_ids:
            return paginator.get_paginated_response([])

        post_map = {
            p.pk: p
            for p in Post.objects.filter(
                pk__in=page_ids,
                status=Post.Status.PUBLISHED,
            )
            .select_related("author", "author__profile")
            .prefetch_related("tags")
        }
        ordered_posts = [post_map[pid] for pid in page_ids if pid in post_map]

        serializer = PostListSerializer(ordered_posts, many=True, context={"request": request})

        # Record views for all posts on this page (deduped per user).
        if ordered_posts:
            if request.user.is_authenticated:
                already_seen = set(
                    PostView.objects.filter(
                        user=request.user,
                        post_id__in=[p.pk for p in ordered_posts],
                    ).values_list("post_id", flat=True)
                )
                new_ids = [p.pk for p in ordered_posts if p.pk not in already_seen]
                if new_ids:
                    PostView.objects.bulk_create(
                        [PostView(user=request.user, post_id=pid) for pid in new_ids],
                        ignore_conflicts=True,
                    )
                    Post.objects.filter(pk__in=new_ids).update(view_count=F("view_count") + 1)
            else:
                Post.objects.filter(
                    pk__in=[p.pk for p in ordered_posts],
                ).update(view_count=F("view_count") + 1)

        return paginator.get_paginated_response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="refresh",
        permission_classes=[IsAuthenticated],
    )
    def refresh(self, request: Request) -> Response:
        """POST /api/v1/feed/refresh/ — generate a new snapshot with a new seed."""
        snapshot = force_new_snapshot(request.user)
        return Response(
            {
                "ok": True,
                "snapshot_id": str(snapshot.id),
                "expires_at": snapshot.expires_at.isoformat(),
                "post_count": len(snapshot.post_ids),
            }
        )
