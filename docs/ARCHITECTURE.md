# Архитектура SlopIt

## 1. Принципы

1. **Тонкий фронт, толстый бекенд.** Вся бизнес-логика, валидация, сортировка ленты —
   на сервере. React — только рендер и UX.
2. **Безопасность по умолчанию.** Сессии в HttpOnly cookie, CSRF, SameSite=Lax,
   CSP, rate-limit на критичных эндпоинтах.
3. **Воспроизводимость.** Любое окружение собирается одной командой `uv sync`.
   Любая лента воспроизводима по `(user_id, snapshot_seed)`.

|  |  |  |
| - | - | - |
|  |  |  |

## 9. Безопасность (OWASP-чеклист)

| Угроза    | Защита                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| SQL injection   | ORM only, никакого raw SQL без `params=`                        |
| XSS             | DRF JSON responses +`bleach` для Markdown в StaticPage                 |
| CSRF            | Django CSRF middleware +`X-CSRFToken` header                               |
| CORS            | django-cors-headers с whitelist, без `*`                               |
| Clickjacking    | `X-Frame-Options: DENY` (Django default)                                   |
| Brute force     | django-ratelimit на `/auth/*` и `/posts/{id}/report`                  |
| File upload     | Магия + MIME двойная проверка, лимит размера |
| Secrets in repo | `.env` в `.gitignore`, проверка в pre-commit                   |
| Insecure deps   | `pip-audit` в CI, Dependabot                                              |
| Open redirect   | AllAuth `LOGIN_REDIRECT_URL` фиксированный                    |

## 10. Тестирование

- **Unit**: pure-функции сервисов, особенно `feed/services/level3.py` (детерминированность
  при одном seed).
- **Integration**: pytest-django + factory-boy, реальная Postgres в CI.
- **Coverage**: ≥ 70% (порог в `pyproject.toml`).
- **CI**: GitHub Actions, matrix на py3.12.

## 11. Что НЕ делаем без необходимости

- Микросервисы. Один Django-monolith — для дипломного объёма оптимально.
- Свой WebSocket. Live-обновления в дипломе не требуются.
- GraphQL. REST + drf-spectacular достаточно.
- Kubernetes. Fly.io machines = достаточно.
