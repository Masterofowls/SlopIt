"""Management command entrypoint for the SlopIt Telegram bot server."""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.bot.server import run_bot_server


class Command(BaseCommand):
    help = "Run the SlopIt Telegram bot server."

    def handle(self, *args: object, **options: object) -> None:
        run_bot_server()
