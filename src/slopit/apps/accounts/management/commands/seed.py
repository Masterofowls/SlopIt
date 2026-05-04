"""Management command: seed the database with test users, tags, and posts."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()

TEST_USERS = [
    {"username": "alice", "email": "alice@example.com", "password": "test1234"},
    {"username": "bob", "email": "bob@example.com", "password": "test1234"},
    {"username": "carol", "email": "carol@example.com", "password": "test1234"},
]

TAGS = ["tech", "gaming", "art", "music", "sports", "food", "travel", "science"]

TEST_POSTS = [
    {
        "author": "alice",
        "title": "Just built my first mechanical keyboard 🎉",
        "body_markdown": (
            "Spent the weekend soldering **Gateron Yellow** switches onto a "
            "65% hotswap PCB. The sound is absolutely *thocky*.\n\n"
            "- Plate: aluminium\n- Keycaps: PBT Cherry profile\n- Lube: Krytox 205g0\n\n"
            "Would recommend to anyone getting into the hobby."
        ),
        "kind": "text",
        "tags": ["tech"],
    },
    {
        "author": "alice",
        "title": "Elden Ring DLC first impressions",
        "body_markdown": (
            "Ten hours in and the Shadow of the Erdtree is **brutal**. "
            "The Scadutree blessings system is a clever way to gate difficulty.\n\n"
            "> If you thought Malenia was hard, wait until you reach the final boss.\n\n"
            "No spoilers here — just go play it."
        ),
        "kind": "text",
        "tags": ["gaming"],
    },
    {
        "author": "bob",
        "title": "My Lo-Fi hip-hop playlist for deep work",
        "body_markdown": (
            "I've been curating this playlist for two years. "
            "Perfect for coding sessions, studying, or just zoning out.\n\n"
            "Key artists: **Nujabes**, Idealism, j^p^n, and potsu.\n\n"
            "Link below if you want to follow along."
        ),
        "kind": "link",
        "link_url": "https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn",
        "tags": ["music"],
    },
    {
        "author": "bob",
        "title": "Made carbonara from scratch — turned out great",
        "body_markdown": (
            "The secret is **no cream** — ever. Real carbonara is just:\n\n"
            "1. Guanciale (or pancetta in a pinch)\n"
            "2. Pecorino Romano + Parmesan\n"
            "3. Eggs (whole + yolks)\n"
            "4. Black pepper — loads of it\n\n"
            "Take the pan off the heat before adding the egg mixture. That's it."
        ),
        "kind": "text",
        "tags": ["food"],
    },
    {
        "author": "carol",
        "title": "Watercolour study — morning light through a window",
        "body_markdown": (
            "Spent about 90 minutes on this. "
            "Wet-on-wet for the sky, dry brush for the curtain texture.\n\n"
            "Still learning how to handle edges — "
            "watercolour is way less forgiving than oils."
        ),
        "kind": "text",
        "tags": ["art"],
    },
    {
        "author": "carol",
        "title": "James Webb just dropped new images — mind blown",
        "body_markdown": (
            "The latest JWST release shows a stellar nursery "
            "in the Carina Nebula with insane detail.\n\n"
            "What gets me: every bright dot in the background is "
            "a **galaxy**, not a star. The scale is incomprehensible.\n\n"
            "Science is so cool."
        ),
        "kind": "text",
        "tags": ["science"],
    },
    {
        "author": "alice",
        "title": "Solo trip to Lisbon — highly recommend",
        "body_markdown": (
            "Five days, no itinerary, no tour groups. Just wandered.\n\n"
            "Highlights:\n"
            "- Pastéis de Belém at 8am with an espresso\n"
            "- Tram 28 through Alfama (go early, it gets packed)\n"
            "- Sunset from Miradouro da Graça\n\n"
            "Flights are cheap from most EU cities. Just go."
        ),
        "kind": "text",
        "tags": ["travel"],
    },
    {
        "author": "bob",
        "title": "Running my first half marathon next month",
        "body_markdown": (
            "Eight weeks of training done. Current PB for 10K is 52 minutes — "
            "targeting sub-2h for the half.\n\n"
            "Training plan: 4 runs/week, one long slow run on Sundays.\n\n"
            "Any tips from experienced runners welcome!"
        ),
        "kind": "text",
        "tags": ["sports"],
    },
]


class Command(BaseCommand):
    help = "Seed the database with test users, tags, and posts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing test users and their posts before seeding.",
        )

    def handle(self, *args, **options):
        from apps.posts.models import Post, Tag

        if options["clear"]:
            emails = [u["email"] for u in TEST_USERS]
            deleted, _ = User.objects.filter(email__in=emails).delete()
            self.stdout.write(self.style.WARNING(f"Cleared {deleted} objects."))

        # ── Tags ──────────────────────────────────────────────────────────────
        tag_objs: dict[str, Tag] = {}
        for name in TAGS:
            tag, _ = Tag.objects.get_or_create(name=name)
            tag_objs[name] = tag
        self.stdout.write(f"  Tags ready: {len(tag_objs)}")

        # ── Users + Profiles ──────────────────────────────────────────────────
        user_objs: dict[str, User] = {}
        for data in TEST_USERS:
            user, created = User.objects.get_or_create(
                email=data["email"],
                defaults={"username": data["username"]},
            )
            if created:
                user.set_password(data["password"])
                user.save()
            # Ensure profile exists (signal may have already created it).
            from apps.accounts.models import Profile
            Profile.objects.get_or_create(user=user)
            user_objs[data["username"]] = user
            status = "created" if created else "exists"
            self.stdout.write(f"  User {user.username!r} — {status}")

        # ── Posts ─────────────────────────────────────────────────────────────
        post_count = 0
        for p in TEST_POSTS:
            author = user_objs[p["author"]]
            post, created = Post.objects.get_or_create(
                author=author,
                title=p["title"],
                defaults={
                    "body_markdown": p.get("body_markdown", ""),
                    "kind": p.get("kind", "text"),
                    "link_url": p.get("link_url", ""),
                    "status": Post.Status.PUBLISHED,
                    "published_at": timezone.now(),
                },
            )
            if created:
                for tag_name in p.get("tags", []):
                    post.tags.add(tag_objs[tag_name])
                post_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Seed complete — {len(user_objs)} users, {post_count} new posts."
            )
        )
