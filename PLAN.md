# SlopIt — Мастер-план

Этот документ — единая точка входа для понимания **что делается, в каком порядке и почему**.

## 1. Цель проекта

Учебный дипломный проект: социальная сеть в стиле Reddit с акцентом на
**собственный алгоритм рандомизации ленты**. Минимум логики на фронте — всё считает бекенд.

## 2. Ключевые требования

### 2.1 Лента (главная фишка)

- Лента — **полностью случайный порядок**, без сортировки по реакциям, времени, популярности.
- Для каждого пользователя — **свой уникальный seed**, лента воспроизводима при перезагрузке.
- Учитываются предпочтения: фильтр по словам/тегам и по типу поста (text / image / video).
- **Автоперегенерация** ленты: по умолчанию каждые **10 часов**, настраивается **10 ч … 48 ч**.
- Алгоритм работает на **3 уровнях** (см. `docs/ALGORITHM.md`):
  1. **Системная лента** — глобальный пул всех публикаций с метаданными для рандомизации.
  2. **Внедрение нового контента** — антиспам/антидубль при публикации новых постов.
  3. **Персональная сортировка** — детерминированная перетасовка под пользователя.

### 2.2 Авторизация

- **Только OAuth**: Google, GitHub, Telegram. Без классического email+password.
- **Опционально** поверх OAuth: passkey (WebAuthn) или passphrase (BIP39-подобная фраза).
- По умолчанию достаточно одного OAuth-логина.

### 2.3 Страницы (фронтенд, рендерит React)

Бекенд должен предоставить API для всех 18 страниц:

| #  | Страница                                         | Endpoint(ы)                                      |
| -- | -------------------------------------------------------- | ------------------------------------------------- |
| 1  | Лендинг                                           | `GET /api/pages/landing`                        |
| 2  | Авторизация (выбор провайдера) | `GET /api/auth/providers`                       |
| 3  | Логин (редирект на OAuth)                 | `GET /api/auth/{provider}/login`                |
| 4  | Регистрация (тот же flow)                | `GET /api/auth/{provider}/login`                |
| 5  | Главная лента                                | `GET /api/feed`                                 |
| 6  | Страница пользователя                | `GET /api/users/{username}`                     |
| 7  | Настройки                                       | `GET/PATCH /api/me/settings`                    |
| 8  | Создание поста                              | `POST /api/posts` (черновик)            |
| 9  | Редактор поста                              | `PATCH /api/posts/{id}`                         |
| 10 | Публикация поста                          | `POST /api/posts/{id}/publish`                  |
| 11 | Админка                                           | Django Admin (`/admin/`, Unfold)                |
| 12 | Отдельный пост                              | `GET /api/posts/{id}`                           |
| 13 | 404                                                      | (фронт-only)                                 |
| 14 | About                                                    | `GET /api/pages/about`                          |
| 15 | Sitemap                                                  | `GET /api/pages/sitemap` + `GET /sitemap.xml` |
| 16 | Лицензии                                         | `GET /api/pages/licenses`                       |
| 17 | Загрузка/обработка                      | `GET /api/posts/{id}/processing-status`         |
| 18 | Технические работы                      | `GET /api/system/status` (флаг maintenance) |

## 3. Архитектура — высокоуровневая схема

```
┌────────────────────┐      HTTPS / JSON      ┌──────────────────────────┐
│  React + Vite SPA  │ ◀─────── Axios ──────▶ │  Django REST API         │
│  (Fly.io app #1)   │                        │  (Fly.io app #2)         │
└────────────────────┘                        │                          │
       │                                      │  ┌────────────────────┐  │
       │ session cookie (HttpOnly, SameSite)  │  │ AllAuth + 3 OAuth  │  │
       │                                      │  └────────────────────┘  │
       │                                      │  ┌────────────────────┐  │
       │                                      │  │ Feed Algorithm     │  │
       │                                      │  │ (3-level service)  │  │
       │                                      │  └────────────────────┘  │
       │                                      │  ┌────────────────────┐  │
       │                                      │  │ Unfold Admin       │  │
       │                                      │  └────────────────────┘  │
       │                                      └────────────┬─────────────┘
       │                                                   │
       │                                                   ▼
       │                                          ┌──────────────────┐
       │                                          │ PostgreSQL       │
       │                                          │ (Supabase)       │
       │                                          └──────────────────┘
       │                                                   ▲
       └──────────── GlitchTip realtime logs ──────────────┘
```

Подробнее — `docs/ARCHITECTURE.md`.

## 4. Этапы реализации

|       Stage | Содержание                                                          | Артефакты                                                                                                           | Статус |
| ----------: | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **1** | План, архитектура, скелет проекта, конфиги | `PLAN.md`, `docs/*`, `pyproject.toml`, `.env.example`, `fly.toml`, `Dockerfile`, пустые Django apps        | ✅           |
| **2** | Доменные модели + миграции                              | `apps/accounts`, `apps/posts`, `apps/feed`, `apps/comments`, `apps/reactions`, `apps/pages`, `apps/moderation` | ✅           |
| **3** | Алгоритм рандомизации (3 уровня)                    | `apps/feed/services/{level1,level2,level3}.py` + тесты                                                                | ✅           |
| **4** | DRF API: ViewSets, сериализаторы, permissions, pagination        | `apps/api/`, OpenAPI schema                                                                                                | ✅           |
| **5** | AllAuth + Google / GitHub / Telegram + passkey                                | OAuth конфиг, callback URLs, passkey flow                                                                              | ✅           |
| **6** | Unfold admin + StaticPages + Sitemap                                          | `apps/pages`, sitemap.xml                                                                                                  | ✅           |
| **7** | Деплой Fly.io (backend) + GitHub Actions + GlitchTip                    | `.github/workflows/deploy.yml`, `fly.toml`                                                                               | ✅           |
| **8** | Frontend Integration Guide                                                    | `docs/FRONTEND_GUIDE.md` финальный                                                                                | ⏳           |

Каждый этап завершается коммитом с conventional message и зелёным CI.

## 5. Структура репозитория

```
SlopIt_App/
├── README.md
├── PLAN.md                       ← этот файл
├── pyproject.toml                ← uv + Ruff + mypy + django-stubs
├── .env.example
├── .gitignore
├── Dockerfile
├── fly.toml
├── .github/workflows/
│   ├── ci.yml                    ← lint + typecheck + tests
│   └── deploy.yml                ← flyctl deploy
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ALGORITHM.md
│   ├── API.md
│   ├── DEPLOY.md
│   └── FRONTEND_GUIDE.md
├── src/
│   └── slopit/
│       ├── manage.py
│       ├── config/
│       │   ├── __init__.py
│       │   ├── settings/
│       │   │   ├── __init__.py
│       │   │   ├── base.py
│       │   │   ├── dev.py
│       │   │   └── prod.py
│       │   ├── urls.py
│       │   ├── wsgi.py
│       │   └── asgi.py
│       └── apps/
│           ├── __init__.py
│           ├── accounts/         ← User, Profile, OAuth, Passkey
│           ├── posts/            ← Post, Tag, Media, Draft
│           ├── comments/         ← Comment threads
│           ├── reactions/        ← Likes/dislikes (для статистики, НЕ для сортировки)
│           ├── feed/             ← 3-уровневый алгоритм + FeedSnapshot
│           ├── moderation/       ← Reports, bans, AutoMod rules
│           ├── pages/            ← StaticPage (Markdown), system flags
│           └── api/              ← DRF root router + auth views
└── tests/
    ├── unit/
    └── integration/
```

## 6. Решения и trade-off-ы

| Решение                                                    | Причина                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Django ORM вместо SQLAlchemy                                | Совместимость с AllAuth/Admin/DRF, одна схема миграций, меньше кода |
| Свой `StaticPage` вместо Django CMS                   | CMS — overkill для SPA-фронта; Markdown через API проще                                  |
| mypy вместо `ty`                                          | `ty` пока в alpha, нет django-stubs совместимости                                     |
| Только Postgres от Supabase                               | AllAuth уже даёт OAuth — Supabase Auth дублировал бы его                              |
| Сессии (HttpOnly cookie) вместо JWT                   | Безопаснее для SPA, проще CSRF, меньше кода                                      |
| Очередь задач — RQ + Redis (план для Stage 3) | Легковеснее Celery; нужно для перегенерации ленты                       |

## 8. Контакт с фронтендом —

- Все запросы — JSON, кроме upload медиа (`multipart/form-data`).
- Аутентификация — `HttpOnly` session cookie + `X-CSRFToken` header.
- CORS: только домен фронта (`https://slopit.fly.dev`) + `localhost:3000` в dev.
- Версионирование: `/api/v1/...`. Несовместимые изменения — `/api/v2/...`.
- Коды ошибок — RFC 7807 (`application/problem+json`).
- Rate-limit заголовки: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

Полный контакт — `docs/API.md`. Гид по интеграции — `docs/FRONTEND_GUIDE.md`.
