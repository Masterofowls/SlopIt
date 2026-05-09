"""Add PostReport model for user-submitted post moderation reports."""

from __future__ import annotations

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0004_post_viewcount_bookmark'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PostReport',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'reason',
                    models.CharField(
                        choices=[
                            ('spam', 'Spam'),
                            ('hate', 'Hate speech'),
                            ('misinfo', 'Misinformation'),
                            ('nsfw', 'NSFW / inappropriate'),
                            ('other', 'Other'),
                        ],
                        default='other',
                        max_length=10,
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'post',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reports',
                        to='posts.post',
                    ),
                ),
                (
                    'reporter',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='post_reports',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'post report',
                'verbose_name_plural': 'post reports',
                'db_table': 'posts_postreport',
                'ordering': ['-created_at'],
                'unique_together': {('post', 'reporter')},
            },
        ),
    ]
