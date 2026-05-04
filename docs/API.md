# SlopIt — REST API контракт

**Base URL (dev)**: `http://localhost:8000/api/v1`
**Base URL (prod)**: `https://slopit-api.fly.dev/api/v1`

**Auth**: HttpOnly session cookie (`sessionid`) + CSRF token (`csrftoken` cookie → `X-CSRFToken` header).
**Format**: `application/json` (ошибки — `application/problem+json`).
**Versioning**: префикс `/api/v1`. Несовместимые изменения → `/api/v2`.

> 🛠 OpenAPI 3.1 schema будет автогенерироваться через `drf-spectacular`:
> `GET /api/schema/` (json), `/api/docs/` (Swagger UI).
> Этот документ — высокоуровневый контракт, авторитетная версия = OpenAPI.

## 1. Аутентификация

### `GET /api/v1/auth/providers`
Список доступных OAuth-провайдеров.
```json
{ "providers": [
  { "id": "google",   "label": "Google",   "login_url": "/accounts/google/login/" },
  { "id": "github",   "label": "GitHub",   "login_url": "/accounts/github/login/" },
  { "id": "telegram", "label": "Telegram", "login_url": "/accounts/telegram/login/" }
] }
```

### Login flow (OAuth)
Фронт делает `window.location = login_url`. AllAuth обрабатывает callback и редиректит
на `FRONTEND_URL/auth/callback?status=ok`. Сессия установлена — далее API вызовы.

### `GET /api/v1/auth/me`
```json
200: { "id": 42, "username": "danil", "avatar_url": "...", "is_admin": false,
       "feed_lifetime_hours": 10 }
401: { "type": "/errors/unauthorized", "title": "Authentication required" }
```

### `POST /api/v1/auth/logout`
Заверщает сессию. `204 No Content`.

### Passkey (опционально, Stage 5)
- `POST /api/v1/auth/passkey/register/begin` → challenge
- `POST /api/v1/auth/passkey/register/complete` → ok
- `POST /api/v1/auth/passkey/verify/begin` → challenge
- `POST /api/v1/auth/passkey/verify/complete` → ok

### Passphrase (опционально)
- `POST /api/v1/auth/passphrase/set` `{ phrase }` → 204
- `POST /api/v1/auth/passphrase/verify` `{ phrase }` → 204 / 401

## 2. Лента

### `GET /api/v1/feed?cursor=0&limit=25`
Возвращает срез текущего активного `FeedSnapshot`. Если snapshot истёк — генерируется новый.

```json
200: {
  "snapshot": {
    "id": "uuid",
    "created_at": "2026-05-04T10:00:00Z",
    "expires_at": "2026-05-04T20:00:00Z",
    "lifetime_hours": 10
  },
  "items": [
    { "id": 7321, "kind": "image", "title": "...", "preview_url": "...",
      "author": { "id": 12, "username": "alice", "avatar_url": "..." },
      "tags": ["art", "ai"], "stats": { "comments": 4, "reactions": 12 } }
  ],
  "next_cursor": 25,
  "total": 1543
}
```

### `POST /api/v1/feed/regenerate`
Принудительно создаёт новый snapshot (например, после смены preferences).
Возвращает новый snapshot (без items — фронт делает следующий GET).

### `GET /api/v1/feed/preferences`
```json
200: {
  "filter_words": ["politics", "spoiler"],
  "filter_post_types": ["image", "video"],
  "muted_tag_ids": [3, 17],
  "muted_user_ids": [42]
}
```

### `PATCH /api/v1/feed/preferences`
Тело — частичный объект из `GET`. Возвращает обновлённый объект; **автоматически
инвалидирует текущий snapshot**.

## 3. Посты

### `GET /api/v1/posts/{id}`
Полный пост + первые N комментариев.

### `POST /api/v1/posts` (создаёт **черновик**)
```json
{ "kind": "text", "title": "Hi", "body_markdown": "..." }
→ 201 { "id": 9001, "status": "draft", ... }
```

### `PATCH /api/v1/posts/{id}` — редактор поста
Только для автора, только если `status` ∈ {draft, processing}.

### `POST /api/v1/posts/{id}/publish`
Переводит черновик в `processing`. Запускается медиа-pipeline. Когда готово —
`status=published`. Фронт может poll'ить:

### `GET /api/v1/posts/{id}/processing-status`
```json
200: { "status": "processing" | "published" | "failed",
       "progress": 0..100, "error": null }
```

### `POST /api/v1/posts/{id}/media` (multipart/form-data)
Загрузка медиафайла к черновику. Возвращает `{ id, url, kind }`.

### `DELETE /api/v1/posts/{id}` — удаление автором.

## 4. Комментарии

| Endpoint | Назначение |
|----------|-----------|
| `GET /api/v1/posts/{id}/comments?cursor=...` | Дерево комментариев, по странично |
| `POST /api/v1/posts/{id}/comments` `{ body, parent_id? }` | Создать |
| `PATCH /api/v1/comments/{id}` | Редактировать (автор) |
| `DELETE /api/v1/comments/{id}` | Удалить (автор / модер) |

## 5. Реакции

| Endpoint | Назначение |
|----------|-----------|
| `POST /api/v1/posts/{id}/reactions` `{ kind: "like" | "dislike" }` | Поставить/сменить |
| `DELETE /api/v1/posts/{id}/reactions` | Снять |
| Аналогично — `comments/{id}/reactions` |

> ⚠️ Реакции **не влияют** на сортировку ленты. Они только для статистики профиля.

## 6. Пользователи

| Endpoint | Назначение |
|----------|-----------|
| `GET /api/v1/users/{username}` | Публичный профиль + посты автора |
| `GET /api/v1/me` | Текущий пользователь (полная инфа) |
| `PATCH /api/v1/me` | Обновить профиль (bio, avatar, etc.) |
| `GET /api/v1/me/settings` | Настройки (`feed_lifetime_hours`, языка и т.д.) |
| `PATCH /api/v1/me/settings` | Обновить настройки |
| `DELETE /api/v1/me` | Удалить аккаунт (требует passphrase, если установлена) |

## 7. Статичные страницы

| Endpoint | Назначение |
|----------|-----------|
| `GET /api/v1/pages/{slug}` | `{ slug, title, body_html, updated_at }` |
| Slugs: `landing`, `about`, `licenses`, `sitemap` |

## 8. Системные

### `GET /api/v1/system/status`
Health-check для Fly.io и фронта.
```json
200: { "ok": true, "maintenance": false, "version": "0.1.0" }
503: { "ok": false, "maintenance": true, "message": "Plannned maintenance until 12:00 UTC" }
```

## 9. Sitemap (вне `/api/v1`)
- `GET /sitemap.xml` — стандартный sitemap, генерируется Django sitemap framework.

## 10. Модерация (только для админов)

| Endpoint | Назначение |
|----------|-----------|
| `POST /api/v1/reports` `{ target_type, target_id, reason }` | Жалоба (любой user) |
| `GET /api/v1/admin/reports` | Список жалоб (admin) |
| `POST /api/v1/admin/posts/{id}/remove` | Удалить пост (admin) |
| `POST /api/v1/admin/users/{id}/ban` | Забанить (admin) |

## 11. Ошибки (RFC 7807)

```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type":   "https://slopit.app/errors/validation",
  "title":  "Validation failed",
  "status": 400,
  "detail": "field 'title' is required",
  "errors": { "title": ["This field is required."] }
}
```

| Тип | Когда |
|-----|-------|
| `/errors/validation` | 400 |
| `/errors/unauthorized` | 401 |
| `/errors/forbidden` | 403 |
| `/errors/not-found` | 404 |
| `/errors/conflict` | 409 (например, дубль контента) |
| `/errors/rate-limited` | 429 |
| `/errors/server` | 500 |

## 12. Rate limits

| Endpoint | Лимит |
|----------|-------|
| `POST /auth/*` | 10/мин/IP |
| `POST /posts` | 30/час/user |
| `POST /comments` | 60/час/user |
| `POST /reactions` | 120/мин/user |
| Прочие GET | 600/мин/user |

Заголовки на каждом ответе: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`. При 429 — `Retry-After`.

## 13. Пагинация

Везде где список — **cursor-based**:
```
GET .../comments?cursor=eyJpZCI6MTIzfQ&limit=20
→ { items, next_cursor: "eyJpZCI6MTQzfQ" | null }
```
Исключение — `/api/v1/feed` использует целочисленный индекс в snapshot (см. §2).
