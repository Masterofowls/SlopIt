# Telegram Auth — Backend Changes & Integration Guide

> **Date**: May 8, 2026
> **Scope**: `slopit-telegram-oidc` OIDC proxy
> **Reason for change**: Telegram permanently shut down `oauth.telegram.org`. The Login Widget (`telegram-widget.js`) and all `data-onauth` flows are **dead and cannot be revived**.

---

## 1. What Broke and Why

The previous implementation used the **Telegram Login Widget**:

```html
<!-- OLD — NO LONGER WORKS -->
<script async
  src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="slopitbot"
  data-size="large"
  data-onauth="onTelegramAuth(user)"
  data-request-access="write">
</script>
```

When a user clicked it, `onTelegramAuth(user)` fired with a signed payload containing `{ id, first_name, last_name, username, photo_url, auth_date, hash }`. The proxy then verified the HMAC-SHA256 `hash` using the bot token, issued an OIDC code, and redirected back to Clerk.

**Why it broke**: `telegram-widget.js` calls `oauth.telegram.org/auth` to get that signed payload. Telegram shut that endpoint down permanently. The widget loads but the `onTelegramAuth` callback never fires. There is no fix, no workaround, and no timeline for restoration.

---

## 2. New Flow — Bot Deep-Link + Webhook

The replacement uses only the **official Telegram Bot API** (never deprecated, no third-party endpoints).

### Flow diagram

```
Browser                    Proxy (slopit-telegram-oidc)       Telegram Bot API
   |                               |                                  |
   |── GET /authorize ────────────▶|                                  |
   |                               |── pendingAuths.set(token) ──▶ (memory)
   |◀── HTML page (Open Telegram) ─|                                  |
   |                               |                                  |
   |── user clicks "Open Telegram" ──────────────────────────────────▶|
   |                               |           t.me/slopitbot?start=TOKEN
   |                               |◀── POST /telegram-webhook ───────|
   |                               |       (update.message.text = "/start TOKEN")
   |                               |── getUserProfilePhotos(userId) ──▶|
   |                               |◀── file_id ───────────────────────|
   |                               |── getFile(file_id) ──────────────▶|
   |                               |◀── file_path ──────────────────────|
   |                               |── auth.status = 'complete'
   |                               |── sendMessage("✅ Signed in!") ──▶|
   |                               |                                  |
   |── GET /auth-status?token=… ──▶|
   |◀── { status: 'complete', redirectUrl } ─|
   |                               |
   |── window.location = redirectUrl (Clerk callback with ?code=…&state=…)
   |
Clerk ── POST /token ────────────▶|
         (exchanges code for JWT)  |
         ◀── id_token (RS256 JWT) ─|
```

### Step-by-step

1. **`GET /authorize?redirect_uri=&state=&nonce=`**
   Proxy generates a `loginToken` (nanoid 32), stores it in `pendingAuths` with 10-minute TTL and status `"pending"`. Returns an HTML page with a button linking to `https://t.me/slopitbot?start=<loginToken>`.

2. **User opens Telegram**
   Telegram opens the bot and automatically sends `/start <loginToken>` as a message.

3. **`POST /telegram-webhook`** (called by Telegram, not the browser)
   - Validates the `x-telegram-bot-api-secret-token` header against `WEBHOOK_SECRET` (random hex set at startup, registered with `setWebhook`).
   - Responds `200 { ok: true }` immediately (Telegram requires sub-2s response).
   - Extracts `loginToken` from message text, looks up `pendingAuths`.
   - Calls `getUserProfilePhotos` → `getFile` to resolve a CDN photo URL.
   - Sets `auth.status = "complete"` and `auth.user = { id, first_name, last_name, username, photo_url }` inside the photo promise `.then()`.
   - Sends a confirmation message back to the user in the bot chat.

4. **`GET /auth-status?token=<loginToken>`** (polled every 2s by the browser page)
   - Returns `{ status: 'pending' }` while waiting.
   - Returns `{ status: 'expired' }` if TTL exceeded.
   - Returns `{ status: 'complete', redirectUrl }` once auth is done. `redirectUrl` is the Clerk callback URL with `?code=<oidcCode>&state=<state>`.

5. **`POST /token`** (called by Clerk server-to-server)
   - Exchanges the OIDC code for an RS256-signed `id_token` (JWT).
   - Claims: `sub = "telegram|<userId>"`, `name`, `given_name`, `family_name`, `preferred_username`, `picture`, `nonce`.

6. **`GET /userinfo`** (called by Clerk if needed)
   - Validates the Bearer `access_token` (same JWT), returns claims as JSON.

---

## 3. Removed Endpoints

| Endpoint | Old role | Status |
|----------|----------|--------|
| `GET /callback` | Received widget `onTelegramAuth` data via query params, verified HMAC hash | **Deleted** |

The `/callback` handler used `crypto.createHmac('sha256', ...)` against the bot token to verify `auth_date + hash`. This entire verification path is gone — it's replaced by the webhook secret check.

---

## 4. New Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/authorize` | GET | none | Start auth, return HTML page |
| `/auth-status` | GET | none | Poll auth completion |
| `/telegram-webhook` | POST | `x-telegram-bot-api-secret-token` header | Receive bot messages from Telegram |
| `/token` | POST | `client_secret` | Exchange OIDC code for JWT |
| `/userinfo` | GET | `Bearer <jwt>` | Return claims from JWT |
| `/.well-known/openid-configuration` | GET | none | OIDC discovery |
| `/.well-known/jwks.json` | GET | none | RSA public key for JWT verification |
| `/health` | GET | none | Liveness check |

---

## 5. Security Changes

### Old: HMAC hash verification (Widget flow)
```js
// Verify Telegram's signature on the widget callback data
const checkString = Object.keys(data)
  .filter(k => k !== 'hash')
  .sort()
  .map(k => `${k}=${data[k]}`)
  .join('\n');
const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
// hmac must equal data.hash
```

### New: Webhook secret header verification
```js
// Telegram signs every webhook delivery with the secret registered via setWebhook
const secret = req.headers['x-telegram-bot-api-secret-token'];
if (secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'forbidden' });
```

`WEBHOOK_SECRET` is a 32-byte random hex string generated once at startup and passed to `setWebhook`. Only Telegram's servers know it. **No user-controlled input is trusted** — the identity comes from `message.from` which Telegram populates server-side.

### Photo URL security
The `photo_url` stored in `auth.user` is a Telegram CDN URL of the form:
```
https://api.telegram.org/file/bot<BOT_TOKEN>/<file_path>
```
The bot token is embedded in the URL. This is standard Telegram behaviour. The URL is only valid while the file exists on Telegram's CDN (~1 year). It is passed to Clerk as the `picture` OIDC claim.

---

## 6. Environment Variables

No changes to required env vars. All were already set as Fly secrets:

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | BotFather token, e.g. `8728778322:AAF...` |
| `BOT_USERNAME` | Bot username without `@`, e.g. `slopitbot` |
| `ISSUER` | `https://slopit-telegram-oidc.fly.dev` |
| `OIDC_CLIENT_ID` | `slopit-clerk` (must match Clerk dashboard) |
| `JWT_PRIVATE_KEY` | RSA-2048 PKCS#8 PEM (newlines as `\n`) |
| `JWT_PUBLIC_KEY` | RSA-2048 SPKI PEM (newlines as `\n`) |

`WEBHOOK_SECRET` is **not** an env var — it is generated fresh each startup and registered with Telegram automatically. Rotating it is automatic on redeploy.

---

## 7. In-Memory State

The proxy is stateless between restarts but uses two `Map` objects during runtime:

```
pendingAuths: Map<loginToken, {
  redirect_uri: string,
  state:        string,
  nonce:        string,
  status:       'pending' | 'complete',
  user?:        { id, first_name, last_name, username, photo_url },
  expires:      number  // Date.now() + 10 min
}>

codeStore: Map<code, {
  user:    { id, first_name, last_name, username, photo_url },
  nonce:   string,
  expires: number  // Date.now() + 5 min
}>
```

Both maps are swept every 60 seconds. OIDC codes are single-use (deleted on first `/token` exchange).

> ⚠️ **Stateless caveat**: If Fly.io routes the webhook POST to a different machine than the browser's poll, the `pendingAuths` entry won't be found. This is fine in the current single-machine setup. If you scale to multiple machines, replace the in-memory maps with Redis or a Fly-native KV store.

---

## 8. BotFather Configuration Required

The following BotFather setting must remain set:

```
/setdomain → slopit-telegram-oidc.fly.dev
```

This is not used by the new flow directly (it was required by the widget), but it should remain set for any future widget or Mini App usage.

No other BotFather changes are needed. The bot does not need `/setprivacy` changed — it only reads messages sent directly to it, never group messages.

---

## 9. Clerk Dashboard Configuration

These settings in the Clerk Dashboard must remain as-is:

| Field | Value |
|-------|-------|
| Discovery Endpoint | `https://slopit-telegram-oidc.fly.dev/.well-known/openid-configuration` |
| Client ID | `slopit-clerk` |
| Client Secret | (set, matches `OIDC_CLIENT_ID` flow) |
| Connection status | **Enabled** |
| Authorized redirect URI (registered in proxy) | `https://quick-bulldog-91.clerk.accounts.dev/v1/oauth_callback` |

The proxy does not validate the Clerk redirect URI against an allowlist — it accepts any `redirect_uri` passed by Clerk. If you want stricter validation, add an allowlist check in the `/authorize` handler.

---

## 10. Testing the Flow Manually

```bash
# 1. Start auth session
curl "https://slopit-telegram-oidc.fly.dev/authorize?redirect_uri=https://example.com/callback&state=test&nonce=abc"
# → Returns HTML page. Find loginToken in the page source (in the JS var loginToken = "...")

# 2. Open Telegram and send: /start <loginToken>  to @slopitbot

# 3. Poll status
curl "https://slopit-telegram-oidc.fly.dev/auth-status?token=<loginToken>"
# → { "status": "complete", "redirectUrl": "https://example.com/callback?code=...&state=test" }

# 4. Extract the code from redirectUrl and exchange it
curl -X POST https://slopit-telegram-oidc.fly.dev/token \
  -d "grant_type=authorization_code&code=<code>&client_id=slopit-clerk"
# → { "access_token": "<jwt>", "id_token": "<jwt>", "token_type": "Bearer", "expires_in": 3600 }

# 5. Decode the JWT (jwt.io) — verify sub = "telegram|<your_tg_id>", picture is populated
```
