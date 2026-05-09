from __future__ import annotations

from django.apps import AppConfig


class BotConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.bot"
    verbose_name = "SlopIt Telegram Bot"
