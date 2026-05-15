from __future__ import annotations

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0007_add_yandex_auth_method'),
        ('accounts', '0007_profile_display_name'),
    ]

    operations = []
