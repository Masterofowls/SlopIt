"""Data migration: replace raw Clerk user_xxx / k_user_xxx IDs stored as
Django usernames with a clean fallback derived from the user's email address.

These IDs were stored when the regex guard in clerk_auth._sync_clerk_profile
was missing the ``k_`` prefix variant, causing Clerk's internal opaque IDs to
be written into User.username instead of the email-based slug fallback.
"""

from __future__ import annotations

import re

from django.db import migrations


_CLERK_ID_RE = re.compile(r"^(clerk_|k_)?user_[a-z0-9]{6,}$", re.IGNORECASE)


def _derive_unique_username(apps, base: str, exclude_pk: int) -> str:
    User = apps.get_model("accounts", "User")
    base = (base[:28] or "user").replace(" ", "_").lower()
    username, counter = base, 1
    while User.objects.filter(username=username).exclude(pk=exclude_pk).exists():
        username = f"{base}{counter}"
        counter += 1
    return username


def fix_clerk_id_usernames(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    dirty = [u for u in User.objects.only("pk", "username", "email") if _CLERK_ID_RE.match(u.username)]
    for user in dirty:
        # Prefer email-based slug; fall back to "user<pk>" for sentinel emails.
        email: str = user.email or ""
        if "@no-email.local" in email or not email:
            base = f"user{user.pk}"
        else:
            base = email.split("@")[0]
        new_username = _derive_unique_username(apps, base, user.pk)
        User.objects.filter(pk=user.pk).update(username=new_username)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_user_auth_method"),
    ]

    operations = [
        migrations.RunPython(fix_clerk_id_usernames, migrations.RunPython.noop),
    ]
