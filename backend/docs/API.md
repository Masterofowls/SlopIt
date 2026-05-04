# SlopIt API Contract (actual)

Backend scope: authentication, algorithm logic, database access, content CRUD, and system health.
Frontend scope: all pages and UI flows.

Base URL (dev): http://localhost:8000/api/v1
Base URL (prod): https://slopit-api.fly.dev/api/v1

Auth model:
- Session cookie (HttpOnly) for authenticated requests.
- CSRF token required for POST/PATCH/PUT/DELETE.

Format:
- Success: application/json
- Errors: application/problem+json (RFC 7807 shape)

OpenAPI schema:
- GET /api/v1/schema/

## 1) Authentication

OAuth providers are handled by django-allauth at /accounts/<provider>/login/.
Use API endpoint below to discover available providers and login URLs.

### GET /api/v1/auth/providers/
Returns configured providers and login URLs.

### GET /api/v1/auth/session/
Returns current auth session state.
- Anonymous: { authenticated: false, user: null }
- Authenticated: { authenticated: true, user: { ... } }

### GET /api/v1/auth/csrf/
Sets csrftoken cookie and returns token value.

### POST /api/v1/auth/logout/
Logs out current session.

### Passphrase endpoints
- GET /api/v1/auth/passphrase/
- POST /api/v1/auth/passphrase/
- POST /api/v1/auth/passphrase/verify/
- DELETE /api/v1/auth/passphrase/delete/

## 2) Me and Preferences

### GET /api/v1/me/
Current user profile.

### PATCH /api/v1/me/
Partial update of current profile.

### GET /api/v1/me/preferences/
Current user feed preferences.

### PATCH /api/v1/me/preferences/
Updates feed preferences and invalidates current feed snapshot.

## 3) Feed

### GET /api/v1/feed/?cursor=0&limit=25
Returns paginated snapshot-based feed for authenticated user.
Response shape:
- count
- next_cursor
- has_more
- results

### POST /api/v1/feed/refresh/
Forces a new feed snapshot for authenticated user.

## 4) Posts

### GET /api/v1/posts/
List posts (published for anonymous, published + own drafts for authenticated user).

### POST /api/v1/posts/
Create post.

### GET /api/v1/posts/{id}/
Retrieve post details.

### PATCH /api/v1/posts/{id}/
Update post (author only).

### DELETE /api/v1/posts/{id}/
Delete post (author/admin rules via permissions).

### POST /api/v1/posts/{id}/publish/
Publish a draft post.

### GET /api/v1/posts/{id}/comments/
List top-level comments for a post.

### POST /api/v1/posts/{id}/react/
Toggle/change/remove reaction for post.
Body: { kind: "like" | "dislike" }

## 5) Comments

### GET /api/v1/comments/{id}/
Retrieve one comment.

### POST /api/v1/comments/
Create comment.
Body includes post, body_markdown, optional parent.

### PATCH /api/v1/comments/{id}/
Update own comment.

### DELETE /api/v1/comments/{id}/
Soft-delete own comment.

## 6) Tags

### GET /api/v1/tags/
List tags.

### GET /api/v1/tags/{id}/
Retrieve tag.

## 7) System

### GET /api/v1/system/status
Health endpoint for platform and frontend probe.

### GET /
Alias to system status for backend-only deployment mode.

## 8) Global API behavior

Pagination:
- Feed uses index cursor pagination (cursor, limit).
- Standard list endpoints use DRF page pagination.

Rate limits:
- Global DRF throttle setup is active.
- anon: 100/hour
- user: 600/min

Error format:
- RFC 7807-like payload via DRF exception handler.
- type field currently uses about:blank.
