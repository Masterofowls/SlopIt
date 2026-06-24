
from __future__ import annotations

import io
from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from PIL import Image
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.api.pagination import StandardResultsPagination
from apps.api.permissions import IsAuthorOrReadOnly
from apps.posts.models import Media, Post, Tag
from apps.posts.serializers import (
    BookmarkSerializer,
    PostDetailSerializer,
    PostListSerializer,
    PostWriteSerializer,
    TagSerializer,
)

MAX_MEDIA_UPLOAD_BYTES = 500 * 1024 * 1024
IMAGE_MAX_DIMENSION = 1280
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"}


class MediaUploadView(APIView):

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request: Request) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"detail": "file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if upload.size > MAX_MEDIA_UPLOAD_BYTES:
            return Response(
                {"detail": "File too large. Maximum size is 500MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        suffix = Path(upload.name or "").suffix.lower()

        if suffix in IMAGE_EXTENSIONS:
            try:
                img = Image.open(upload)
                img = img.convert("RGB")
                img.thumbnail((IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85, optimize=True)
                buf.seek(0)
                suffix = ".jpg"
                upload = ContentFile(buf.read(), name=f"image{suffix}")
            except Exception:
                upload.seek(0)

        filename = f"posts/media/uploads/{uuid4().hex}{suffix}"
        stored_path = default_storage.save(filename, upload)
        file_url = default_storage.url(stored_path)

        media_id: int | None = None
        post_id = request.data.get("post_id")
        if post_id is not None and post_id != "":
            post = Post.objects.filter(pk=post_id, author=request.user).first()
            if post is None:
                return Response(
                    {"detail": "post not found or not owned by current user."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            media_kind = request.data.get("kind", Media.Kind.IMAGE)
            allowed_kinds = {choice[0] for choice in Media.Kind.choices}
            if media_kind not in allowed_kinds:
                return Response(
                    {"detail": (f"kind must be one of: {', '.join(sorted(allowed_kinds))}.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            media = Media.objects.create(
                post=post,
                kind=media_kind,
                file=stored_path,
                processing_status=Media.ProcessingStatus.DONE,
            )
            media_id = media.id

        return Response(
            {
                "url": request.build_absolute_uri(file_url),
                "media_id": media_id,
            },
            status=status.HTTP_201_CREATED,
        )


class TagViewSet(ReadOnlyModelViewSet):

    queryset = Tag.objects.order_by("name")
    serializer_class = TagSerializer
    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthenticatedOrReadOnly]


def _record_view(request: "Request", post: "Post") -> None:  
    from django.db.models import F

    from apps.posts.models import PostView

    if request.user.is_authenticated:
        _, created = PostView.objects.get_or_create(user=request.user, post=post)
        if created:
            Post.objects.filter(pk=post.pk).update(view_count=F("view_count") + 1)
    else:
        Post.objects.filter(pk=post.pk).update(view_count=F("view_count") + 1)


class PostViewSet(ModelViewSet):

    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthorOrReadOnly]
    lookup_field = "pk"

    def get_queryset(self):
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
        from django.db.models.functions import Coalesce

        from apps.reactions.models import Reaction

        ct = ContentType.objects.get_for_model(Post)

        like_sq = (
            Reaction.objects.filter(
                content_type=ct,
                object_id=OuterRef("pk"),
                kind="like",
            )
            .values("object_id")
            .annotate(c=Count("id"))
            .values("c")
        )
        dislike_sq = (
            Reaction.objects.filter(
                content_type=ct,
                object_id=OuterRef("pk"),
                kind="dislike",
            )
            .values("object_id")
            .annotate(c=Count("id"))
            .values("c")
        )

        qs = (
            Post.objects.select_related("author", "author__profile")
            .prefetch_related("tags", "media")
            .annotate(
                comment_count=Count(
                    "comments",
                    filter=Q(comments__is_deleted=False),
                    distinct=True,
                ),
                like_count=Coalesce(Subquery(like_sq, output_field=IntegerField()), 0),
                dislike_count=Coalesce(Subquery(dislike_sq, output_field=IntegerField()), 0),
            )
            .order_by("-published_at", "-created_at")
        )

        qs = qs.filter(status=Post.Status.PUBLISHED)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(author__username__icontains=search)
                | Q(author__first_name__icontains=search)
                | Q(author__last_name__icontains=search)
                | Q(author__profile__display_name__icontains=search)
            ).distinct()

        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        request = self.request
        if request and request.user.is_authenticated:
            from django.contrib.contenttypes.models import ContentType

            from apps.posts.models import Bookmark
            from apps.reactions.models import Reaction

            ct = ContentType.objects.get_for_model(Post)
            rows = Reaction.objects.filter(
                user=request.user,
                content_type=ct,
            ).values("object_id", "kind")
            ctx["user_reactions"] = {r["object_id"]: r["kind"] for r in rows}
            ctx["user_bookmarks"] = set(
                Bookmark.objects.filter(user=request.user).values_list("post_id", flat=True)
            )
        return ctx

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PostWriteSerializer
        if self.action in ("retrieve", "by_slug"):
            return PostDetailSerializer
        return PostListSerializer

    def retrieve(self, request: Request, *args: object, **kwargs: object) -> Response:
        instance = self.get_object()
        _record_view(request, instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path=r"by-slug/(?P<slug>[^/.]+)",
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def by_slug(self, request: Request, slug: str | None = None) -> Response:
        from django.db.models import F
        from django.shortcuts import get_object_or_404

        from apps.posts.models import PostView

        post = get_object_or_404(self.get_queryset(), slug=slug)
        _record_view(request, post)
        serializer = self.get_serializer(post)
        return Response(serializer.data)

    def perform_create(self, serializer) -> None:  
        serializer.save(
            author=self.request.user,
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )

    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        post = serializer.instance
        output = PostDetailSerializer(post, context=self.get_serializer_context())
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(
        detail=True,
        methods=["post"],
        url_path="publish",
        permission_classes=[IsAuthenticated, IsAuthorOrReadOnly],
    )
    def publish(self, request: Request, pk: str | None = None) -> Response:
        post: Post = self.get_object()

        if post.status == Post.Status.PUBLISHED:
            return Response(PostDetailSerializer(post, context={"request": request}).data)
        if post.status == Post.Status.REMOVED:
            return Response(
                {"detail": "Removed posts cannot be republished."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        post.status = Post.Status.PUBLISHED
        post.published_at = timezone.now()
        post.save(update_fields=["status", "published_at", "updated_at"])

        return Response(PostDetailSerializer(post, context={"request": request}).data)

    @extend_schema(parameters=[OpenApiParameter("page", int, description="Page number")])
    @action(
        detail=True,
        methods=["get"],
        url_path="comments",
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def comments(self, request: Request, pk: str | None = None) -> Response:
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Count, IntegerField, OuterRef, Subquery
        from django.db.models.functions import Coalesce

        from apps.comments.models import Comment
        from apps.comments.serializers import CommentSerializer
        from apps.reactions.models import Reaction

        post = self.get_object()
        ct = ContentType.objects.get_for_model(Comment)

        like_sq = (
            Reaction.objects.filter(content_type=ct, object_id=OuterRef("pk"), kind="like")
            .values("object_id")
            .annotate(c=Count("id"))
            .values("c")
        )
        dislike_sq = (
            Reaction.objects.filter(content_type=ct, object_id=OuterRef("pk"), kind="dislike")
            .values("object_id")
            .annotate(c=Count("id"))
            .values("c")
        )

        qs = (
            Comment.objects.filter(post=post, parent__isnull=True)
            .annotate_reply_count()
            .annotate(
                like_count=Coalesce(Subquery(like_sq, output_field=IntegerField()), 0),
                dislike_count=Coalesce(Subquery(dislike_sq, output_field=IntegerField()), 0),
            )
            .select_related("author", "author__profile")
            .order_by("created_at")
        )

        page = self.paginate_queryset(qs)
        items = page if page is not None else qs

        
        ctx = {"request": request}
        if request.user.is_authenticated:
            comment_ids = [c.pk for c in items]
            rows = Reaction.objects.filter(
                user=request.user,
                content_type=ct,
                object_id__in=comment_ids,
            ).values("object_id", "kind")
            ctx["user_comment_reactions"] = {r["object_id"]: r["kind"] for r in rows}

        serialized = CommentSerializer(items, many=True, context=ctx).data
        if page is not None:
            return self.get_paginated_response(serialized)
        return Response(serialized)

    @action(
        detail=True,
        methods=["post"],
        url_path="react",
        permission_classes=[IsAuthenticated],
    )
    def react(self, request: Request, pk: str | None = None) -> Response:
        from django.contrib.contenttypes.models import ContentType
        from django.db.models import Count

        from apps.reactions.models import Reaction
        from apps.reactions.serializers import ReactionToggleSerializer

        post = self.get_object()
        serializer = ReactionToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kind = serializer.validated_data["kind"]

        ct = ContentType.objects.get_for_model(Post)
        existing = Reaction.objects.filter(
            user=request.user, content_type=ct, object_id=post.pk
        ).first()

        if existing:
            if existing.kind == kind:
                existing.delete()
                user_reaction = None
            else:
                existing.kind = kind
                existing.save(update_fields=["kind"])
                user_reaction = kind
        else:
            Reaction.objects.create(
                user=request.user,
                kind=kind,
                content_type=ct,
                object_id=post.pk,
            )
            user_reaction = kind

        
        qs = Reaction.objects.filter(content_type=ct, object_id=post.pk)
        counts_rows = qs.values("kind").annotate(n=Count("id"))
        reaction_counts = {"like": 0, "dislike": 0}
        for row in counts_rows:
            reaction_counts[row["kind"]] = row["n"]

        return Response(
            {
                "reaction_counts": reaction_counts,
                "user_reaction": user_reaction,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="bookmark",
        permission_classes=[IsAuthenticated],
    )
    def bookmark(self, request: Request, pk: str | None = None) -> Response:
        from apps.posts.models import Bookmark

        post = self.get_object()

        if request.method == "DELETE":
            deleted, _ = Bookmark.objects.filter(user=request.user, post=post).delete()
            if not deleted:
                return Response(
                    {"detail": "Bookmark not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response({"is_bookmarked": False}, status=status.HTTP_200_OK)

        
        _, created = Bookmark.objects.get_or_create(user=request.user, post=post)
        return Response(
            {"is_bookmarked": True},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="report",
        permission_classes=[IsAuthenticated],
    )
    def report(self, request: Request, pk: str | None = None) -> Response:
        from apps.posts.models import PostReport

        post = self.get_object()

        
        reason = request.data.get("reason", PostReport.Reason.OTHER)
        valid_reasons = {r.value for r in PostReport.Reason}
        if reason not in valid_reasons:
            reason = PostReport.Reason.OTHER

        _, created = PostReport.objects.get_or_create(
            post=post,
            reporter=request.user,
            defaults={"reason": reason},
        )
        return Response(
            {"reported": True},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="vote",
        permission_classes=[IsAuthenticated],
    )
    def vote(self, request: Request, pk: str | None = None) -> Response:
        from django.db import transaction

        from apps.posts.models import PollVote
        from apps.posts.serializers import PollVoteSerializer

        post = self.get_object()
        if post.kind != Post.Kind.POLL:
            return Response(
                {"detail": "This post is not a poll."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PollVoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        option_index = serializer.validated_data["option_index"]

        td = post.template_data or {}
        options = td.get("options", [])
        if option_index >= len(options):
            return Response(
                {"detail": "Invalid option index."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            existing_vote = PollVote.objects.filter(post=post, voter=request.user).first()

            if existing_vote:
                if existing_vote.option_index == option_index:
                    
                    options[existing_vote.option_index]["votes"] = max(
                        0, options[existing_vote.option_index]["votes"] - 1
                    )
                    existing_vote.delete()
                    user_vote = None
                else:
                    
                    options[existing_vote.option_index]["votes"] = max(
                        0, options[existing_vote.option_index]["votes"] - 1
                    )
                    options[option_index]["votes"] = options[option_index].get("votes", 0) + 1
                    existing_vote.option_index = option_index
                    existing_vote.save(update_fields=["option_index", "updated_at"])
                    user_vote = option_index
            else:
                
                options[option_index]["votes"] = options[option_index].get("votes", 0) + 1
                PollVote.objects.create(
                    post=post,
                    voter=request.user,
                    option_index=option_index,
                )
                user_vote = option_index

            td["options"] = options
            post.template_data = td
            post.save(update_fields=["template_data", "updated_at"])

        return Response(
            {"template_data": post.template_data, "user_vote": user_vote},
            status=status.HTTP_200_OK,
        )


class TrendingTagsView(APIView):

    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request: Request) -> Response:
        import re
        from collections import Counter
        from datetime import timedelta

        from django.utils import timezone

        cutoff = timezone.now() - timedelta(hours=24)
        bodies = Post.objects.filter(
            status=Post.Status.PUBLISHED,
            published_at__gte=cutoff,
        ).values_list("body_markdown", flat=True)

        counter: Counter = Counter()
        pattern = re.compile(r"#(\w{2,50})")
        for body in bodies:
            if body:
                for tag in pattern.findall(body):
                    counter[tag.lower()] += 1

        top = [{"tag": tag, "count": cnt} for tag, cnt in counter.most_common(10)]
        return Response(top)
