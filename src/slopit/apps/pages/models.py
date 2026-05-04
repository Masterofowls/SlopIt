"""Domain models for static content pages and system feature flags."""

from __future__ import annotations

from django.db import models


def _render_markdown(source: str) -> str:
    import bleach
    import markdown as md

    raw_html = md.markdown(source, extensions=["extra", "toc"])
    return bleach.clean(
        raw_html,
        tags=[
            "p",
            "br",
            "strong",
            "em",
            "s",
            "ul",
            "ol",
            "li",
            "blockquote",
            "code",
            "pre",
            "a",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "hr",
        ],
        attributes={"a": ["href", "rel", "title"]},
        strip=True,
    )


class StaticPage(models.Model):
    """A CMS-like static page managed from the admin."""

    class Slug(models.TextChoices):
        LANDING = "landing", "Landing / Home"
        ABOUT = "about", "About"
        LICENSES = "licenses", "Licenses"
        SITEMAP = "sitemap", "Sitemap"

    slug = models.SlugField(
        max_length=50,
        unique=True,
        choices=Slug.choices,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    body_markdown = models.TextField()
    body_html = models.TextField(blank=True, editable=False)  # cached
    is_active = models.BooleanField(default=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pages_staticpage"
        verbose_name = "static page"
        verbose_name_plural = "static pages"

    def __str__(self) -> str:
        return f"{self.title} ({self.slug})"

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        if self.body_markdown:
            self.body_html = _render_markdown(self.body_markdown)
        super().save(*args, **kwargs)


class SystemFlag(models.Model):
    """Key-value feature flag or system configuration entry.

    Flags can be toggled in the admin without a code deploy.
    Examples: ``feature_passkeys_enabled``, ``feed_intake_paused``.
    """

    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pages_systemflag"
        ordering = ["key"]
        verbose_name = "system flag"
        verbose_name_plural = "system flags"

    def __str__(self) -> str:
        return f"{self.key} = {self.value!r}"
