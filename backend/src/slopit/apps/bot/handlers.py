from __future__ import annotations

import logging
from typing import Any

from telegram import BotCommand, Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from apps.bot.config import BotSettings
from apps.bot.services import fetch_api_status

logger = logging.getLogger(__name__)


def _chat_id(update: Update) -> str:
    message = getattr(update, "effective_message", None)
    if message and getattr(message, "chat", None):
        return str(message.chat.id)
    return "unknown"


def _user_label(update: Update) -> str:
    user = getattr(update, "effective_user", None)
    if not user:
        return "unknown"
    username = f"@{user.username}" if user.username else "(no-username)"
    return f"id={user.id} {username}"


class SlopItBotHandlers:
    def __init__(self, config: BotSettings):
        self.config = config

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.info("/start from %s chat=%s", _user_label(update), _chat_id(update))
        await update.message.reply_text(
            "Welcome to *SlopIt*!\n\n"
            "A Reddit-inspired social network with a three-level randomised feed.\n\n"
            f"Open the app: {self.config.frontend_url}\n"
            "Type /help for available commands.",
            parse_mode="Markdown",
        )

    async def help_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.info("/help from %s chat=%s", _user_label(update), _chat_id(update))
        await update.message.reply_text(
            "*SlopIt Bot Commands*\n\n"
            "/start  - welcome message\n"
            "/help   - this list\n"
            "/status - check if the API is online\n"
            "/ping   - bot liveness check\n"
            "/id     - show your chat and user id\n"
            "/echo <text> - echo text back",
            parse_mode="Markdown",
        )

    async def ping(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.info("/ping from %s chat=%s", _user_label(update), _chat_id(update))
        await update.message.reply_text("pong")

    async def id_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.info("/id from %s chat=%s", _user_label(update), _chat_id(update))
        user = update.effective_user
        chat = update.effective_chat
        await update.message.reply_text(
            f"chat_id={chat.id}\nuser_id={user.id}\nusername={user.username or '(none)'}"
        )

    async def echo(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.info("/echo from %s chat=%s", _user_label(update), _chat_id(update))
        text = " ".join(context.args).strip()
        if not text:
            await update.message.reply_text("Usage: /echo your text")
            return
        await update.message.reply_text(text)

    async def status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.info("/status from %s chat=%s", _user_label(update), _chat_id(update))
        try:
            data = fetch_api_status(self.config.status_url)
            if data.get("ok"):
                msg = f"API is online (v{data.get('version', '?')})"
            else:
                msg = "API is in maintenance mode."
        except Exception as exc:  # noqa: BLE001
            logger.exception("/status check failed: %s", exc)
            msg = f"API unreachable: {exc}"
        await update.message.reply_text(msg)

    async def on_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        text = (update.effective_message.text or "").strip()
        logger.info(
            "text from %s chat=%s text=%r",
            _user_label(update),
            _chat_id(update),
            text[:200],
        )
        await update.message.reply_text("Use /help to see available commands.")

    async def on_unknown(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        text = (update.effective_message.text or "").strip()
        logger.info(
            "unknown command from %s chat=%s command=%r",
            _user_label(update),
            _chat_id(update),
            text,
        )
        await update.message.reply_text("Unknown command. Use /help.")

    async def on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        logger.exception("Telegram handler error; update=%r", update, exc_info=context.error)

    async def post_init(self, application: Application) -> None:
        await application.bot.set_my_commands(
            [
                BotCommand("start", "Welcome message"),
                BotCommand("help", "Show command list"),
                BotCommand("status", "API status check"),
                BotCommand("ping", "Bot liveness check"),
                BotCommand("id", "Show your chat/user IDs"),
                BotCommand("echo", "Echo text"),
            ]
        )
        me = await application.bot.get_me()
        logger.info("bot identity: id=%s username=@%s", me.id, me.username)

    def register(self, application: Application) -> None:
        application.add_handler(CommandHandler("start", self.start))
        application.add_handler(CommandHandler("help", self.help_cmd))
        application.add_handler(CommandHandler("status", self.status))
        application.add_handler(CommandHandler("ping", self.ping))
        application.add_handler(CommandHandler("id", self.id_cmd))
        application.add_handler(CommandHandler("echo", self.echo))
        application.add_handler(MessageHandler(filters.COMMAND, self.on_unknown))
        application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.on_text))
        application.add_error_handler(self.on_error)
