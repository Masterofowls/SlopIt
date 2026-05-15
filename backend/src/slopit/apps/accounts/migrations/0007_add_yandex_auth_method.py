from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0006_fix_clerk_id_usernames'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='auth_method',
            field=models.CharField(
                blank=True,
                choices=[
                    ('google', 'Google'),
                    ('github', 'GitHub'),
                    ('yandex', 'Yandex'),
                    ('telegram', 'Telegram'),
                ],
                db_index=True,
                default='',
                help_text=(
                    'OAuth provider used on most recent login: google, github, yandex, or telegram. '
                    'Blank means not yet determined.'
                ),
                max_length=16,
            ),
        ),
    ]
