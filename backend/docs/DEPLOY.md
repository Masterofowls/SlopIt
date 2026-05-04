# Деплой — Fly.io + Supabase + GitHub Actions

## 1. Подготовка аккаунтов

| Сервис | Что нужно |
|--------|-----------|
| **Supabase** | Project → копируем `Connection string` (Session pooler, не Transaction) |
| **Fly.io** | `flyctl auth login`, billing привязан |
| **GlitchTip** | Project → копируем DSN |
| **Google Cloud** | OAuth 2.0 Client ID (тип Web). Redirect: `https://slopit-api.fly.dev/accounts/google/login/callback/` |
| **GitHub** | Settings → Developer Settings → OAuth Apps. Аналогично |
| **Telegram** | `@BotFather`, получаем `bot_token`, `bot_username`. Domain: `slopit-api.fly.dev` |

## 2. Создание Fly app

```powershell
cd C:\Users\mrdan\SlopIt_App

# Создать app (имя должно совпадать с fly.toml)
flyctl apps create slopit-api --org personal

# Установить секреты (не коммитятся!)
flyctl secrets set `
  DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(50))')" `
  DJANGO_DEBUG=False `
  DJANGO_ALLOWED_HOSTS="slopit-api.fly.dev,slopit.fly.dev" `
  DJANGO_CSRF_TRUSTED_ORIGINS="https://slopit.fly.dev" `
  FRONTEND_URL="https://slopit.fly.dev" `
  DATABASE_URL="postgres://...@...supabase.co:5432/postgres" `
  GOOGLE_OAUTH_CLIENT_ID="..." `
  GOOGLE_OAUTH_CLIENT_SECRET="..." `
  GITHUB_OAUTH_CLIENT_ID="..." `
  GITHUB_OAUTH_CLIENT_SECRET="..." `
  TELEGRAM_BOT_TOKEN="..." `
  TELEGRAM_BOT_USERNAME="..." `
  GLITCHTIP_DSN="..."

# Создать Redis (Upstash через Fly extensions)
flyctl redis create --name slopit-redis --region fra
# Затем:
flyctl secrets set REDIS_URL="$(flyctl redis status slopit-redis --json | jq -r .private_url)"
```

## 3. Первый деплой

```powershell
flyctl deploy
flyctl logs           # смотрим, что migrations прошли
flyctl ssh console    # внутри: python src/slopit/manage.py createsuperuser
```

## 4. Frontend (отдельный Fly app — Stage 8)

```powershell
flyctl apps create slopit --org personal   # фронт-домен https://slopit.fly.dev
# В корне фронт-репо: Dockerfile (multistage Node build → nginx статика).
flyctl deploy
```

## 5. GitHub Actions

См. `.github/workflows/deploy.yml`. Триггер — push в `main`.
Нужен secret `FLY_API_TOKEN` в репо: `flyctl auth token` → копируем.

## 6. Бекапы

Supabase делает автобекапы бесплатного плана раз в день. Дополнительно — раз в неделю
вручную: `pg_dump $DATABASE_URL > backup-$(Get-Date -Format yyyyMMdd).sql`.

## 7. Откат

```powershell
flyctl releases                    # список релизов
flyctl releases rollback <version>
```

## 8. Maintenance mode

```powershell
flyctl secrets set MAINTENANCE_MODE=True
# Ждать ~30 секунд — release_command не нужен, просто рестарт
flyctl machine restart
```

Фронт получит `503` от `/api/v1/system/status` и покажет страницу #18.
