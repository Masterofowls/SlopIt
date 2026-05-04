# Frontend Integration Guide

## 0. для фронтенд-разработчика

- **Стек**: React + Vite + JavaScript + Axios. Без TypeScript (по решению владельца проекта).
- **Backend dev**: `http://localhost:8000`. Prod: `https://slopit-api.fly.dev`.
- **Auth**: только OAuth, сессии в HttpOnly cookie. Передавайте `withCredentials: true`.
- **CSRF**: считывайте cookie `csrftoken` → header `X-CSRFToken` для POST/PATCH/DELETE.
- **Полный список endpoint'ов**: `docs/API.md`. **Алгоритм ленты**: `docs/ALGORITHM.md`.
- **OpenAPI**: `GET /api/schema/`. Swagger UI: `/api/docs/`.

## 1. Структура фронт-репозитория (рекомендация)

```
slopit-frontend/
├── package.json
├── vite.config.js
├── .env.development          # VITE_API_BASE=http://localhost:8000
├── .env.production           # VITE_API_BASE=https://slopit-api.fly.dev
├── src/
│   ├── api/
│   │   ├── client.js         # axios instance + CSRF + interceptors
│   │   ├── auth.js
│   │   ├── feed.js
│   │   ├── posts.js
│   │   ├── comments.js
│   │   ├── reactions.js
│   │   ├── users.js
│   │   └── pages.js
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   ├── AuthPage.jsx
│   │   ├── LoginPage.jsx       # выбор OAuth провайдера
│   │   ├── RegisterPage.jsx    # тот же flow что Login
│   │   ├── FeedPage.jsx        ★ главная — потребляет /api/v1/feed
│   │   ├── UserPage.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── PostCreatePage.jsx
│   │   ├── PostEditorPage.jsx
│   │   ├── PostPublishPage.jsx
│   │   ├── PostPage.jsx        # отдельный пост + комменты
│   │   ├── AdminPage.jsx       # редирект на /admin/ (Django Unfold)
│   │   ├── NotFoundPage.jsx
│   │   ├── AboutPage.jsx
│   │   ├── SitemapPage.jsx
│   │   ├── LicensesPage.jsx
│   │   ├── ProcessingPage.jsx  # poll /posts/{id}/processing-status
│   │   └── MaintenancePage.jsx # показывается если /system/status maintenance
│   ├── components/
│   ├── routes.jsx              # react-router-dom
│   ├── store/                  # Zustand или React Context (минимум state)
│   └── main.jsx
└── Dockerfile                  # multistage: node build → nginx static
```

## 2. Базовый axios client

```js
// src/api/client.js
import axios from 'axios';

function getCookie(name) {
  const v = document.cookie.match(`(^|;)\\s*${name}=([^;]+)`);
  return v ? decodeURIComponent(v[2]) : null;
}

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE}/api/v1`,
  withCredentials: true,        // ← обязательно для session cookie
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (['post', 'patch', 'put', 'delete'].includes(config.method)) {
    const csrf = getCookie('csrftoken');
    if (csrf) config.headers['X-CSRFToken'] = csrf;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // редирект на /login — сессия истекла
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
```

## 3. OAuth flow

```js
// src/api/auth.js
import { api } from './client';

export const getProviders = () => api.get('/auth/providers');
export const me            = () => api.get('/auth/me');
export const logout        = () => api.post('/auth/logout');

// На LoginPage:
//   <a href={provider.login_url}>Sign in with Google</a>
// AllAuth откроет провайдера, после callback редиректнет на FRONTEND_URL/auth/callback
```

```jsx
// src/pages/AuthCallbackPage.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { me } from '../api/auth';

export default function AuthCallback() {
  const nav = useNavigate();
  useEffect(() => {
    me().then(() => nav('/feed')).catch(() => nav('/login'));
  }, []);
  return <p>Signing in…</p>;
}
```

## 4. Главная лента

```js
// src/api/feed.js
import { api } from './client';

export const getFeed         = (cursor = 0, limit = 25) =>
  api.get('/feed', { params: { cursor, limit } });
export const regenerateFeed  = () => api.post('/feed/regenerate');
export const getPreferences  = () => api.get('/feed/preferences');
export const updatePreferences = (patch) => api.patch('/feed/preferences', patch);
```

```jsx
// src/pages/FeedPage.jsx — упрощённо
function FeedPage() {
  const [items, setItems]   = useState([]);
  const [cursor, setCursor] = useState(0);
  const [next, setNext]     = useState(0);

  useEffect(() => { loadMore(); }, []);

  async function loadMore() {
    const { data } = await getFeed(next, 25);
    setItems((prev) => [...prev, ...data.items]);
    setNext(data.next_cursor);   // null = конец snapshot
  }

  return (
    <>
      {items.map((p) => <PostCard key={p.id} post={p} />)}
      {next !== null && <button onClick={loadMore}>Load more</button>}
      {next === null && (
        <button onClick={async () => {
          await regenerateFeed();
          setItems([]); setNext(0); loadMore();
        }}>Refresh feed</button>
      )}
    </>
  );
}
```

> **Важно**: НЕ перегенерируйте snapshot на каждой загрузке страницы. snapshot
> живёт `feed_lifetime_hours` (10–48 ч) — пользователь видит ту же ленту при reload.
> Это **главное требование** проекта.

## 5. Создание/публикация поста

Flow:

1. `POST /posts` → получаем `id`, статус `draft`.
2. (опционально) `POST /posts/{id}/media` несколько раз — заливаем картинки/видео.
3. `PATCH /posts/{id}` — обновляем title/body.
4. `POST /posts/{id}/publish` → `status=processing`.
5. На странице `/posts/{id}/processing` poll'им `/posts/{id}/processing-status` каждые 2 с.
6. Когда `status=published` — редирект на `/posts/{id}`.

## 6. Maintenance / 404

В корне `<App />` сделайте hook:

```js
useEffect(() => {
  api.get('/system/status').then(({ data }) => {
    if (data.maintenance) navigate('/maintenance');
  });
}, []);
```

## 7. Деплой фронта на Fly

`Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri /index.html;     # SPA fallback
  }
}
```

`fly.toml` для фронта (отдельный app, имя `slopit`):

```toml
app = "slopit"
primary_region = "fra"
[build]
  dockerfile = "Dockerfile"
[http_service]
  internal_port = 80
  force_https = true
[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = "256mb"
```

## 8. Разработка локально (одновременно бекенд + фронт)

```powershell
# Терминал 1 — backend
cd C:\Users\mrdan\SlopIt_App
.\.venv\Scripts\Activate.ps1
python src/slopit/manage.py runserver 0.0.0.0:8000

# Терминал 2 — frontend
cd C:\Users\mrdan\slopit-frontend
npm run dev   # Vite на 3000
```

Backend разрешает CORS для `http://localhost:3000` (см. `.env.example` → `FRONTEND_URL`).

## 10. Чеклист готовности фронта к интеграции

- [ ] axios client с `withCredentials` и CSRF
- [ ] router со всеми 18 страницами
- [ ] AuthCallback page
- [ ] FeedPage с пагинацией по cursor
- [ ] PostEditor с upload медиа
- [ ] Polling status processing
- [ ] Maintenance check на старте
- [ ] Глобальный 401-handler → redirect /login
- [ ] Error boundary с показом RFC7807 details
