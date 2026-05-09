"""Live smoke-test page — /tests

Accessible to logged-in staff only.  Runs a set of fast, read-only checks
against the live DB/config and renders an HTML results page.

This is intentionally NOT a pytest suite — it runs in the web process with
real connections so it's useful on Fly.io to confirm OAuth / Sites / DB
are wired correctly after a deploy.
"""

from __future__ import annotations

import time
import traceback
from dataclasses import dataclass, field
from typing import Callable

from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpRequest, HttpResponse
from django.utils.html import escape

# ─── Result model ────────────────────────────────────────────────────────────


@dataclass
class Check:
    name: str
    passed: bool
    detail: str = ""
    elapsed_ms: float = 0.0


def _run(name: str, fn: Callable[[], str]) -> Check:
    """Execute *fn*, capture pass/fail + detail + timing."""
    t0 = time.perf_counter()
    try:
        detail = fn()
        passed = True
    except Exception as exc:  # noqa: BLE001
        detail = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        passed = False
    elapsed = (time.perf_counter() - t0) * 1000
    return Check(name=name, passed=passed, detail=detail, elapsed_ms=elapsed)


# ─── Individual checks ────────────────────────────────────────────────────────


def _check_db_connection() -> str:
    from django.db import connection

    with connection.cursor() as cur:
        cur.execute("SELECT version()")
        row = cur.fetchone()
    return str(row[0])[:80]


def _check_sites_framework() -> str:
    from django.conf import settings
    from django.contrib.sites.models import Site

    site = Site.objects.get(pk=settings.SITE_ID)
    assert site.domain, "Site domain is empty"
    return f"id={site.pk}  domain={site.domain}  name={site.name}"


def _check_clerk_jwks_url() -> str:
    from django.conf import settings

    url: str = getattr(settings, "CLERK_JWKS_URL", "")
    assert url, "CLERK_JWKS_URL is not set — add it via: flyctl secrets set CLERK_JWKS_URL=..."
    assert url.startswith("https://"), f"CLERK_JWKS_URL must start with https://, got: {url!r}"
    # Probe the endpoint to confirm it returns valid JWKS JSON.
    import urllib.request

    with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310
        import json

        data = json.loads(resp.read())
    assert "keys" in data, f"JWKS response missing 'keys' field: {list(data)}"
    return f"url={url}  keys={len(data['keys'])}"


def _check_allauth_settings() -> str:
    from django.conf import settings

    proto = getattr(settings, "ACCOUNT_DEFAULT_HTTP_PROTOCOL", "")
    assert proto == "https", f"Expected 'https', got '{proto}'"
    site_id = settings.SITE_ID
    assert site_id == 1, f"Expected SITE_ID=1, got {site_id}"
    redirect = settings.LOGIN_REDIRECT_URL
    assert redirect.startswith("http"), f"LOGIN_REDIRECT_URL looks wrong: {redirect}"
    return (
        f"ACCOUNT_DEFAULT_HTTP_PROTOCOL={proto}  SITE_ID={site_id}  LOGIN_REDIRECT_URL={redirect}"
    )


def _check_headless_frontend_urls() -> str:
    from django.conf import settings

    urls = getattr(settings, "HEADLESS_FRONTEND_URLS", {})
    for key, val in urls.items():
        assert val.startswith("http"), (
            f"HEADLESS_FRONTEND_URLS[{key!r}] is relative (should be absolute): {val!r}"
        )
    return "  ".join(f"{k}={v[:40]}" for k, v in urls.items())


def _check_cors_origin() -> str:
    from django.conf import settings

    origins = settings.CORS_ALLOWED_ORIGINS
    assert origins, "CORS_ALLOWED_ORIGINS is empty"
    return ", ".join(origins)


def _check_frontend_url() -> str:
    from django.conf import settings

    url = getattr(settings, "FRONTEND_URL", "")
    assert url.startswith("http"), f"FRONTEND_URL looks wrong: {url!r}"
    return url


def _check_telegram_bot_token() -> str:
    from django.conf import settings

    token: str = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    assert token, "TELEGRAM_BOT_TOKEN is not set — run: scripts/fly-set-telegram.ps1"
    # Validate format: "<numeric_id>:<alphanumeric_hash>"
    parts = token.split(":", 1)
    assert len(parts) == 2 and parts[0].isdigit(), (
        f"TELEGRAM_BOT_TOKEN has unexpected format: {token[:12]}…"
    )
    client_id: str = getattr(settings, "TELEGRAM_CLIENT_ID", "")
    redirect_uri: str = getattr(settings, "TELEGRAM_REDIRECT_URI", "")
    assert redirect_uri.startswith("https://"), (
        f"TELEGRAM_REDIRECT_URI must start with https://, got: {redirect_uri!r}"
    )
    return f"bot_id={parts[0]}  client_id={client_id}  redirect_uri={redirect_uri}"


# ─── View ────────────────────────────────────────────────────────────────────

CHECKS: list[tuple[str, Callable[[], str]]] = [
    ("Database connection", _check_db_connection),
    ("Django Sites framework (Site #1)", _check_sites_framework),
    ("Clerk JWKS URL reachable", _check_clerk_jwks_url),
    ("allauth settings (HTTPS + SITE_ID + redirect)", _check_allauth_settings),
    ("HEADLESS_FRONTEND_URLS are absolute", _check_headless_frontend_urls),
    ("FRONTEND_URL env var", _check_frontend_url),
    ("CORS allowed origins", _check_cors_origin),
    ("Telegram bot token configured", _check_telegram_bot_token),
]


@staff_member_required(login_url="/admin/login/")
def smoke_test_view(request: HttpRequest) -> HttpResponse:
    results = [_run(name, fn) for name, fn in CHECKS]

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    overall_ok = passed == total

    rows = ""
    for r in results:
        icon = "✅" if r.passed else "❌"
        status_class = "pass" if r.passed else "fail"
        detail_html = f'<pre class="detail">{escape(r.detail)}</pre>' if r.detail else ""
        rows += (
            f'<tr class="{status_class}">'
            f'<td class="icon">{icon}</td>'
            f'<td class="name">{escape(r.name)}</td>'
            f'<td class="ms">{r.elapsed_ms:.1f} ms</td>'
            f'<td class="detail-cell">{detail_html}</td>'
            "</tr>\n"
        )

    summary_class = "ok" if overall_ok else "fail"
    summary_text = (
        f"All {total} checks passed"
        if overall_ok
        else f"{passed}/{total} passed — {total - passed} FAILED"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SlopIt Backend — Smoke Tests</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 900px;
           margin: 2rem auto; padding: 0 1rem; background:#f8f9fa; color:#212529; }}
    h1   {{ font-size:1.6rem; margin-bottom:.25rem; }}
    .summary {{ padding:.6rem 1rem; border-radius:6px; font-weight:600;
                margin-bottom:1.5rem; font-size:1.1rem; }}
    .summary.ok   {{ background:#d1e7dd; color:#0a3622; }}
    .summary.fail {{ background:#f8d7da; color:#58151c; }}
    table {{ width:100%; border-collapse:collapse; background:#fff;
             border-radius:8px; overflow:hidden;
             box-shadow:0 1px 4px rgba(0,0,0,.08); }}
    th  {{ background:#343a40; color:#fff; padding:.5rem .75rem;
           text-align:left; font-size:.8rem; text-transform:uppercase; }}
    td  {{ padding:.5rem .75rem; border-bottom:1px solid #dee2e6;
           vertical-align:top; font-size:.9rem; }}
    tr.pass {{ background:#fff; }}
    tr.fail {{ background:#fff5f5; }}
    .icon  {{ width:2rem; font-size:1.1rem; }}
    .ms    {{ width:6rem; color:#6c757d; white-space:nowrap; }}
    pre.detail {{ margin:.25rem 0 0; font-size:.75rem; white-space:pre-wrap;
                  word-break:break-all; color:#842029; background:#fff0f0;
                  border:1px solid #f5c2c7; border-radius:4px;
                  padding:.4rem .6rem; max-height:10rem; overflow:auto; }}
    .refresh {{ margin-top:1rem; font-size:.85rem; color:#6c757d; }}
    a {{ color:#0d6efd; }}
  </style>
</head>
<body>
  <h1>🔍 SlopIt Backend — Smoke Tests</h1>
  <div class="summary {summary_class}">{summary_text}</div>
  <table>
    <thead>
      <tr>
        <th></th><th>Check</th><th>Time</th><th>Detail</th>
      </tr>
    </thead>
    <tbody>
{rows}
    </tbody>
  </table>
  <p class="refresh">
    <a href="/tests">↺ Re-run</a> &nbsp;·&nbsp;
    <a href="/admin/">Admin</a> &nbsp;·&nbsp;
    <a href="/api/v1/system/status">Health check</a>
  </p>
</body>
</html>"""

    status_code = 200 if overall_ok else 503
    return HttpResponse(html, content_type="text/html; charset=utf-8", status=status_code)
