"""Data migration: fix posts that have an empty slug."""

import uuid

from django.db import migrations
from django.utils.text import slugify


def fix_empty_slugs(apps, schema_editor):
    Post = apps.get_model("posts", "Post")
    for post in Post.objects.filter(slug=""):
        base = slugify(post.title)[:100] or "post"
        post.slug = f"{base}-{uuid.uuid4().hex[:8]}"
        post.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(fix_empty_slugs, migrations.RunPython.noop),
    ]
