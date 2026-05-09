"""Add clerk_id to accounts.User."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_social_avatar_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="clerk_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Clerk user ID — the 'sub' claim from a verified Clerk JWT.",
                max_length=64,
                null=True,
                unique=True,
            ),
        ),
    ]
