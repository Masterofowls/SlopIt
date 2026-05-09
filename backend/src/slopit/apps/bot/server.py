from __future__ import annotations

import asyncio
import logging
import socket

from telegram.ext import Application

from apps.bot.config import BotSettings
from apps.bot.handlers import SlopItBotHandlers

logger = logging.getLogger(__name__)


def _configure_logging(level_name: str) -> None:
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.getLogger().setLevel(level)


def build_application(config: BotSettings) -> Application:
    handlers = SlopItBotHandlers(config)
    app = Application.builder().token(config.token).post_init(handlers.post_init).build()
    handlers.register(app)
    return app


async def run_async(config: BotSettings) -> None:
    app = build_application(config)
    logger.info("slopitbot polling started.")
    await app.run_polling(drop_pending_updates=config.drop_pending_updates)


def run_bot_server() -> None:
    config = BotSettings.from_django()
    _configure_logging(config.log_level)
    config.validate()

    logger.info(
        "runbot starting: log_level=%s frontend_url=%s status_url=%s host=%s",
        config.log_level,
        config.frontend_url,
        config.status_url,
        socket.gethostname(),
    )

    try:
        asyncio.run(run_async(config))
    except KeyboardInterrupt:
        logger.info("slopitbot stopped by keyboard interrupt.")
