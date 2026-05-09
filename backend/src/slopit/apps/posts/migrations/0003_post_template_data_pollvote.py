"""Add template_data JSONField to Post, add POLL/ALERT/NEWS kinds, and create PollVote."""

from __future__ import annotations

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0002_fix_empty_slugs"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Extend Post.kind choices (no schema change needed — TextChoices only)
        migrations.AlterField(
            model_name="post",
            name="kind",
            field=models.CharField(
                choices=[
                    ("text", "Text"),
                    ("image", "Image"),
                    ("video", "Video"),
                    ("link", "Link"),
                    ("poll", "Poll"),
                    ("alert", "Alert"),
                    ("news", "News"),
                ],
                default="text",
                max_length=10,
            ),
        ),
        # Add template_data JSONField
        migrations.AddField(
            model_name="post",
            name="template_data",
            field=models.JSONField(
                blank=True,
                null=True,
                help_text=(
                    "Structured data for template kinds. "
                    "Poll: {options: [{text, votes}], allow_multiple: bool}. "
                    "Alert: {level: info|warn|danger, icon: str}."
                ),
            ),
        ),
        # Create PollVote model
        migrations.CreateModel(
            name="PollVote",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "option_index",
                    models.PositiveSmallIntegerField(),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "post",
                    models.ForeignKey(
                        limit_choices_to={"kind": "poll"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="poll_votes",
                        to="posts.post",
                    ),
                ),
                (
                    "voter",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="poll_votes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "poll vote",
                "verbose_name_plural": "poll votes",
                "db_table": "posts_pollvote",
                "unique_together": {("post", "voter")},
            },
        ),
    ]
