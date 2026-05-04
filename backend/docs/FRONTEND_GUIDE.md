# Frontend Integration Guide (backend-only architecture)

This project is split as:
- Backend: algorithm logic, auth/session, DB, API endpoints.
- Frontend: all pages, all UX, all user-facing rendering.

Backend dev URL: http://localhost:8000
Backend prod URL: https://slopit-api.fly.dev

## 1) Required client settings

- Use withCredentials: true in HTTP client.
- Read csrftoken cookie and send X-CSRFToken for POST/PATCH/PUT/DELETE.
- Treat backend as API-only service.

Example Axios setup:

```js
import axios from 'axios';

function getCookie(name) {
  const v = document.cookie.match(`(^|;)\\s*${name}=([^;]+)`);
  return v ? decodeURIComponent(v[2]) : null;
}

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE}/api/v1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (['post', 'patch', 'put', 'delete'].includes(config.method)) {
    const csrf = getCookie('csrftoken');
    if (csrf) config.headers['X-CSRFToken'] = csrf;
  }
  return config;
});
```

## 2) Native OAuth flow (Google/GitHub/Telegram)

Backend already provides provider discovery:
- GET /api/v1/auth/providers/

Frontend login flow:
1. Call GET /api/v1/auth/providers/
2. Render your own native buttons.
3. On click, do full-page redirect to provider.login_url.
4. After callback, call GET /api/v1/auth/session/ and route user.

Auth endpoints used by frontend:
- GET /api/v1/auth/providers/
- GET /api/v1/auth/session/
- GET /api/v1/auth/csrf/
- POST /api/v1/auth/logout/

## 3) Core API mapping for frontend

Feed:
- GET /api/v1/feed/?cursor=0&limit=25
- POST /api/v1/feed/refresh/

Profile and preferences:
- GET /api/v1/me/
- PATCH /api/v1/me/
- GET /api/v1/me/preferences/
- PATCH /api/v1/me/preferences/

Posts:
- GET /api/v1/posts/
- POST /api/v1/posts/
- GET /api/v1/posts/{id}/
- PATCH /api/v1/posts/{id}/
- DELETE /api/v1/posts/{id}/
- POST /api/v1/posts/{id}/publish/
- GET /api/v1/posts/{id}/comments/
- POST /api/v1/posts/{id}/react/

Comments:
- GET /api/v1/comments/{id}/
- POST /api/v1/comments/
- PATCH /api/v1/comments/{id}/
- DELETE /api/v1/comments/{id}/

Tags:
- GET /api/v1/tags/
- GET /api/v1/tags/{id}/

System:
- GET /api/v1/system/status

## 4) Notes for architecture cleanup

- Do not rely on backend docs HTML pages or sitemap for frontend flows.
- Keep frontend routes and static pages in frontend repo.
- Keep backend focused on data and business logic only.

## 5) Quick integration checklist

- Axios/fetch configured with credentials and CSRF.
- Native OAuth buttons implemented via /auth/providers.
- Session bootstrap on app start via /auth/session.
- 401 handler redirects to login route.
- Feed page uses cursor + refresh snapshot flow.
- Preferences page uses /me/preferences endpoints.
