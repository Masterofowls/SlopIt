"""Management command: upsert PostFeedMeta for every published post.

Run on every deploy via release_command so that posts created before the
signal-based intake was working are included in the feed pool.

Usage:
    python manage.py rebuild_feed_pool
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.feed.services.level2_intake import on_post_published
from apps.posts.models import Post


class Command(BaseCommand):
    help = "Upsert PostFeedMeta for all published posts missing from the feed pool."

    def handle(self, *args: object, **options: object) -> None:
        from apps.feed.models import PostFeedMeta

        already = set(PostFeedMeta.objects.values_list("post_id", flat=True))
        qs = (
            Post.objects.filter(status=Post.Status.PUBLISHED)
            .exclude(pk__in=already)
            .select_related("author")
            .prefetch_related("tags")
        )
        total = qs.count()
        if total == 0:
            self.stdout.write("Feed pool already up to date.")
            return

        self.stdout.write(f"Indexing {total} post(s) into feed pool…")
        ok = 0
        for post in qs.iterator(chunk_size=100):
            try:
                on_post_published(post)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"  SKIP post {post.pk}: {exc}")

        self.stdout.write(self.style.SUCCESS(f"Done — {ok}/{total} posts indexed."))
