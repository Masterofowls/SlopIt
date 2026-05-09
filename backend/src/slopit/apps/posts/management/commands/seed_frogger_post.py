"""Management command: seed a test post by 'frogger' with a real image."""

from __future__ import annotations

import io
import urllib.request
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()

IMAGE_URL = (
    "https://peaceful-flower-536.fly.dev/"
    "christiane-s-hartl-gsqpUyM0DPI-unsplash.jpg"
)
IMAGE_FILENAME = "christiane-s-hartl-gsqpUyM0DPI-unsplash.jpg"


class Command(BaseCommand):
    help = "Create a published test post by frogger with a real image from Supabase."

    def handle(self, *args: object, **options: object) -> None:
        # 1. Create or get user frogger
        user, created = User.objects.get_or_create(
            username="frogger",
            defaults={
                "email": "frogger@example.com",
                "is_active": True,
            },
        )
        if created:
            user.set_password("test1234")
            user.save()
            self.stdout.write(self.style.SUCCESS("Created user: frogger"))
        else:
            self.stdout.write("User frogger already exists.")

        # 2. Download the image from the public frontend URL
        self.stdout.write(f"Downloading image from {IMAGE_URL} …")
        try:
            req = urllib.request.Request(
                IMAGE_URL,
                headers={"User-Agent": "slopit-seed/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                image_bytes = resp.read()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Download failed: {exc}"))
            return

        self.stdout.write(
            f"Downloaded {len(image_bytes):,} bytes. Uploading to storage …"
        )

        # 3. Upload to Supabase Storage via default_storage
        storage_path = f"posts/media/uploads/{uuid4().hex}.jpg"
        stored_path = default_storage.save(
            storage_path,
            ContentFile(image_bytes),
        )
        file_url = default_storage.url(stored_path)
        self.stdout.write(self.style.SUCCESS(f"Stored at: {file_url}"))

        # 4. Build body_markdown with embedded image
        body_markdown = f"good morning\n\n![selfie]({file_url})"

        # 5. Create and publish the post
        from apps.posts.models import Post

        post, post_created = Post.objects.get_or_create(
            author=user,
            title="selfie",
            defaults={
                "body_markdown": body_markdown,
                "kind": Post.Kind.IMAGE,
                "status": Post.Status.PUBLISHED,
                "published_at": timezone.now(),
            },
        )

        if not post_created:
            # Update existing post with fresh image URL
            post.body_markdown = body_markdown
            post.status = Post.Status.PUBLISHED
            post.published_at = post.published_at or timezone.now()
            post.save()
            self.stdout.write("Updated existing post 'selfie' by frogger.")
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created post '{post.title}' (id={post.pk}, slug={post.slug})"
                )
            )

        self.stdout.write(self.style.SUCCESS("Done. Post is publicly visible."))
