from __future__ import annotations

from dataclasses import dataclass, field

from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand
from django.db import transaction


@dataclass(frozen=True)
class SocialAppConfig:
    provider: str
    name: str
    client_id_env: str
    secret_env: str
    settings: dict = field(default_factory=dict)


SOCIAL_APP_CONFIGS = [
    SocialAppConfig(
        provider='google',
        name='Google',
        client_id_env='GOOGLE_OAUTH_CLIENT_ID',
        secret_env='GOOGLE_OAUTH_CLIENT_SECRET',  # noqa: S106
    ),
    SocialAppConfig(
        provider='github',
        name='GitHub',
        client_id_env='GITHUB_OAUTH_CLIENT_ID',
        secret_env='GITHUB_OAUTH_CLIENT_SECRET',  # noqa: S106
    ),
    SocialAppConfig(
        provider='telegram',
        name='Telegram',
        client_id_env='TELEGRAM_OAUTH_CLIENT_ID',
        secret_env='TELEGRAM_OAUTH_CLIENT_SECRET',  # noqa: S106
    ),
]


class Command(BaseCommand):
    help = 'Create or update allauth SocialApp records from environment variables.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--domain',
            default='slopit-api.fly.dev',
            help='Domain to assign to Site(id=1) and attach SocialApp records to.',
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        from allauth.socialaccount.models import SocialApp
        from config.settings.base import env
        from django.conf import settings

        domain = options['domain']
        site, _ = Site.objects.get_or_create(
            pk=settings.SITE_ID,
            defaults={"domain": domain, "name": "SlopIt API"},
        )
        site.domain = domain
        site.name = "SlopIt API"
        site.save(update_fields=['domain', 'name'])

        created = 0
        updated = 0
        skipped = 0

        for config in SOCIAL_APP_CONFIGS:
            client_id = env(config.client_id_env, default='')
            secret = env(config.secret_env, default='')
            if not client_id:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped {config.provider}: missing {config.client_id_env}"
                    )
                )
                continue

            app, was_created = SocialApp.objects.update_or_create(
                provider=config.provider,
                provider_id='',
                defaults={
                    'name': config.name,
                    'client_id': client_id,
                    'secret': secret,
                    'key': '',
                    'settings': config.settings,
                },
            )
            app.sites.set([site])
            if was_created:
                created += 1
            else:
                updated += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Synced {config.provider}: client_id={client_id[:8]}..."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. created={created}, updated={updated}, skipped={skipped}, site={site.domain}"
            )
        )
