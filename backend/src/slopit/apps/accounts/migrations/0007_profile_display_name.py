"""Add display_name field to Profile model."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_fix_clerk_id_usernames"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="display_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="User-set custom display name; takes priority over Clerk data.",
                max_length=100,
            ),
        ),
    ]
