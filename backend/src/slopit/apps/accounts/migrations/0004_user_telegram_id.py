"""Add telegram_id to accounts.User."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_user_clerk_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="telegram_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="Telegram user ID from the Login Widget / OIDC callback.",
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
    ]
