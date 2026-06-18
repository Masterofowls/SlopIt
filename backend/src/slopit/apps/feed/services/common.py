from __future__ import annotations

import hashlib
import struct
from typing import TYPE_CHECKING

from django.conf import settings

from apps.feed.simhash import compute as simhash_compute

if TYPE_CHECKING:
    from apps.posts.models import Post


BUCKET_COUNT: int = getattr(settings, "FEED_BUCKET_COUNT", 256)
ROTATION_MODULO = 1024
BURST_WINDOW_SECONDS = 5 * 60
NEIGHBOR_RANGE = 1


def stable_hash(value: int) -> int:
    digest = hashlib.md5(struct.pack(">q", value), usedforsecurity=False).digest()
    return struct.unpack(">Q", digest[:8])[0]


def post_text(post: Post) -> str:
    return f"{post.title} {post.body_markdown}"


def post_content_hash(post: Post) -> str:
    text = post_text(post)
    return simhash_compute(text)
