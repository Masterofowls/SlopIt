from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlencode

import pytest

playwright_sync = pytest.importorskip("playwright.sync_api")

LOCAL_BROWSERS_PATH = Path(__file__).resolve().parents[1] / ".playwright"
if "PLAYWRIGHT_BROWSERS_PATH" not in os.environ and LOCAL_BROWSERS_PATH.exists():
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(LOCAL_BROWSERS_PATH)

REMOTE_AUTH_E2E_ENABLED = os.getenv("AUTH_E2E_PLAYWRIGHT", "0") == "1"

BASE_URL = os.getenv("AUTH_E2E_BASE_URL", "https://slopit-api.fly.dev").rstrip("/")
FRONTEND_URL = os.getenv("AUTH_E2E_FRONTEND_URL", "https://peaceful-flower-536.fly.dev")

EXPECTED_PROVIDER_HOSTS: dict[str, tuple[str, ...]] = {
    "google": ("accounts.google.com",),
    "github": ("github.com",),
    "telegram": (
        "oauth.telegram.org",
        "telegram.org",
    ),
}

TEST_LOGIN_USERS = [
    {
        "username": "alice",
        "email": "alice@example.com",
        "password": "test1234",
    },
    {
        "username": "bob",
        "email": "bob@example.com",
        "password": "test1234",
    },
]


def _full(path: str) -> str:
    return f"{BASE_URL}{path}"


def _find_login_field(page: object) -> object:
    login_locator = page.locator("input[name='login']")
    if login_locator.count():
        return login_locator.first

    email_locator = page.locator("input[name='email']")
    if email_locator.count():
        return email_locator.first

    raise AssertionError("Could not find login/email input on the auth form")


@pytest.fixture(name="api_context")
def fixture_api_context() -> object:
    with playwright_sync.sync_playwright() as p:
        context = p.request.new_context(base_url=BASE_URL, ignore_https_errors=True)
        try:
            yield context
        finally:
            context.dispose()


@pytest.fixture(name="browser")
def fixture_browser() -> object:
    with playwright_sync.sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True)
        except Exception as exc:
            pytest.skip(f"Playwright Chromium is unavailable: {exc}")

        try:
            yield browser
        finally:
            browser.close()


@pytest.fixture(name="auth_test_settings")
def fixture_auth_test_settings(settings: object) -> object:
    settings.LOGIN_REDIRECT_URL = "/api/v1/system/status"
    settings.ACCOUNT_LOGOUT_REDIRECT_URL = "/api/v1/system/status"
    settings.FRONTEND_URL = "http://localhost:3000"
    return settings


@pytest.fixture(name="login_user")
def fixture_login_user(transactional_db: object, request: object) -> dict[str, str]:
    from django.contrib.auth import get_user_model

    del transactional_db
    data = request.param
    get_user_model().objects.create_user(
        username=data["username"],
        email=data["email"],
        password=data["password"],
    )
    return data


@pytest.mark.integration
@pytest.mark.skipif(
    not REMOTE_AUTH_E2E_ENABLED,
    reason="Set AUTH_E2E_PLAYWRIGHT=1 to run remote OAuth redirect/callback checks.",
)
class TestAuthPlaywrightRedirects:
    def test_auth_providers_endpoint_lists_all_providers(self, api_context: object) -> None:
        response = api_context.get(_full("/api/v1/auth/providers/"))
        assert response.ok

        data = response.json()
        provider_ids = {item["id"] for item in data["providers"]}
        assert provider_ids.issuperset({"google", "github", "telegram"})

    def test_provider_login_redirects_to_external_oauth(self, api_context: object) -> None:
        for provider, expected_hosts in EXPECTED_PROVIDER_HOSTS.items():
            response = api_context.get(
                _full(f"/accounts/{provider}/login/"),
                max_redirects=0,
            )
            assert response.status in {301, 302, 303, 307, 308}

            location = response.headers.get("location", "")
            assert location, f"Missing Location header for provider {provider}"
            assert any(host in location for host in expected_hosts), (
                f"Unexpected redirect target for {provider}: {location}"
            )

    def test_provider_callback_endpoint_handles_error_query_without_500(
        self,
        api_context: object,
    ) -> None:
        query = urlencode({"error": "access_denied", "state": "playwright-test"})

        for provider in EXPECTED_PROVIDER_HOSTS:
            response = api_context.get(
                _full(f"/accounts/{provider}/login/callback/?{query}"),
                max_redirects=0,
            )
            assert response.status < 500, (
                f"Callback should not crash for {provider}. Status: {response.status}"
            )

    def test_login_redirect_url_points_to_frontend(self, api_context: object) -> None:
        response = api_context.get(_full("/accounts/login/"), max_redirects=0)
        assert response.status in {200, 301, 302, 303, 307, 308}

        location = response.headers.get("location", "")
        assert location
        assert FRONTEND_URL.rstrip("/") in location.rstrip("/") or "/accounts/" in location


@pytest.mark.integration
@pytest.mark.django_db(transaction=True)
class TestAuthPlaywrightSessionCycle:
    @pytest.mark.parametrize("login_user", TEST_LOGIN_USERS, indirect=True)
    def test_login_session_and_logout_cycle(
        self,
        auth_test_settings: object,
        browser: object,
        live_server: object,
        login_user: dict[str, str],
    ) -> None:
        del auth_test_settings

        context = browser.new_context(base_url=live_server.url)
        page = context.new_page()

        try:
            page.goto(f"{live_server.url}/accounts/login/")

            login_input = _find_login_field(page)
            login_input.fill(login_user["email"])
            page.locator("input[name='password']").first.fill(login_user["password"])

            with page.expect_navigation(wait_until="load"):
                page.locator("button[type='submit'], input[type='submit']").first.click()

            assert "/api/v1/system/status" in page.url

            session_payload = page.evaluate(
                """
                async (baseUrl) => {
                    const url = `${baseUrl}/api/v1/auth/session/`;
                    const response = await fetch(url, { credentials: 'include' });
                    return { status: response.status, data: await response.json() };
                }
                """,
                live_server.url,
            )
            assert session_payload["status"] == 200
            assert session_payload["data"]["authenticated"] is True
            assert session_payload["data"]["user"]["username"] == login_user["username"]

            csrf_payload = page.evaluate(
                """
                async (baseUrl) => {
                    const url = `${baseUrl}/api/v1/auth/csrf/`;
                    const response = await fetch(url, { credentials: 'include' });
                    return await response.json();
                }
                """,
                live_server.url,
            )
            logout_status = page.evaluate(
                """
                async ({ baseUrl, csrfToken }) => {
                    const url = `${baseUrl}/api/v1/auth/logout/`;
                    const response = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'X-CSRFToken': csrfToken,
                            'Accept': 'application/json'
                        }
                    });
                    return response.status;
                }
                """,
                {
                    "baseUrl": live_server.url,
                    "csrfToken": csrf_payload["csrfToken"],
                },
            )
            assert logout_status == 204

            logged_out_session_payload = page.evaluate(
                """
                async (baseUrl) => {
                    const url = `${baseUrl}/api/v1/auth/session/`;
                    const response = await fetch(url, { credentials: 'include' });
                    return { status: response.status, data: await response.json() };
                }
                """,
                live_server.url,
            )
            assert logged_out_session_payload["status"] == 200
            assert logged_out_session_payload["data"]["authenticated"] is False
            assert logged_out_session_payload["data"]["user"] is None
        finally:
            context.close()
