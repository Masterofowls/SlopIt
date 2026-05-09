from __future__ import annotations

import os
from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class BotSettings:
    token: str
    frontend_url: str
    status_url: str
    log_level: str
    drop_pending_updates: bool

    @classmethod
    def from_django(cls) -> "BotSettings":
        token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
        frontend_url = getattr(settings, "FRONTEND_URL", "https://peaceful-flower-536.fly.dev")
        status_url = os.getenv(
            "TELEGRAM_STATUS_URL", "https://slopit-api.fly.dev/api/v1/system/status"
        )
        log_level = os.getenv("TELEGRAM_BOT_LOG_LEVEL", "INFO").upper()
        drop_pending = os.getenv("TELEGRAM_DROP_PENDING_UPDATES", "true").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        return cls(
            token=token,
            frontend_url=frontend_url,
            status_url=status_url,
            log_level=log_level,
            drop_pending_updates=drop_pending,
        )

    def validate(self) -> None:
        if not self.token:
            raise RuntimeError(
                "TELEGRAM_BOT_TOKEN is not set. Use: flyctl secrets set TELEGRAM_BOT_TOKEN=..."
            )
