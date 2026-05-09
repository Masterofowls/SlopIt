"""Add auth_method field to accounts.User."""

from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_user_telegram_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="auth_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("google", "Google"),
                    ("github", "GitHub"),
                    ("telegram", "Telegram"),
                ],
                db_index=True,
                default="",
                help_text=(
                    "OAuth provider used on most recent login: google, github, or telegram. "
                    "Blank means not yet determined."
                ),
                max_length=16,
            ),
        ),
    ]
