import express from 'express';
import crypto from 'crypto';
import { SignJWT, jwtVerify, exportJWK, importPKCS8, importSPKI } from 'jose';
import { nanoid } from 'nanoid';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Env vars ──────────────────────────────────────────────────────────────────
const {
  BOT_TOKEN,        // from BotFather
  BOT_USERNAME,     // without @ e.g. "SlopItBot"
  ISSUER,           // https://slopit-telegram-oidc.fly.dev
  OIDC_CLIENT_ID,   // must match what you put in Clerk
  PORT = '8080',
  JWT_PRIVATE_KEY,  // RSA PEM, newlines as \n
  JWT_PUBLIC_KEY,   // RSA PEM, newlines as \n
} = process.env;

const REQUIRED = ['BOT_TOKEN', 'BOT_USERNAME', 'ISSUER', 'OIDC_CLIENT_ID', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY'];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

// ── Load RSA keys ─────────────────────────────────────────────────────────────
const privateKey = await importPKCS8(JWT_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
const publicKey  = await importSPKI(JWT_PUBLIC_KEY.replace(/\\n/g, '\n'), 'RS256');
const publicJwk  = await exportJWK(publicKey);
publicJwk.kid = 'telegram-oidc-1';
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

// ── In-memory auth code store ─────────────────────────────────────────────────
// { code -> { user, nonce, expires } }
const codeStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of codeStore) if (v.expires < now) codeStore.delete(k);
}, 60_000);

// ── Telegram hash verification ────────────────────────────────────────────────
function verifyTelegramData(data) {
  const { hash, ...fields } = data;
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v != null && v !== '')
  );
  const checkString = Object.keys(clean)
    .sort()
    .map(k => `${k}=${clean[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  if (hmac !== hash) return false;
  // Reject data older than 10 minutes
  if (Date.now() / 1000 - parseInt(data.auth_date, 10) > 600) return false;
  return true;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

// OIDC Discovery
app.get('/.well-known/openid-configuration', (_, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint:         `${ISSUER}/token`,
    userinfo_endpoint:      `${ISSUER}/userinfo`,
    jwks_uri:               `${ISSUER}/.well-known/jwks.json`,
    response_types_supported:               ['code'],
    subject_types_supported:                ['public'],
    id_token_signing_alg_values_supported:  ['RS256'],
    scopes_supported:                       ['openid', 'profile'],
    token_endpoint_auth_methods_supported:  ['client_secret_post', 'client_secret_basic', 'none'],
    claims_supported: ['sub', 'iss', 'aud', 'iat', 'exp', 'nonce',
                       'name', 'given_name', 'family_name', 'picture', 'preferred_username'],
  });
});

// JWKS
app.get('/.well-known/jwks.json', (_, res) => {
  res.json({ keys: [publicJwk] });
});

// Authorization — show Telegram Login Widget
app.get('/authorize', (req, res) => {
  const { redirect_uri, state = '', nonce = '' } = req.query;
  if (!redirect_uri) return res.status(400).send('Missing redirect_uri');

  const callbackParams = new URLSearchParams({ redirect_uri, state, nonce });

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Continue with Telegram</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #0f0f1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid #2a2a4e;
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      max-width: 360px;
      width: 90%;
      box-shadow: 0 24px 48px rgba(0,0,0,0.4);
    }
    h1 { color: #fff; font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { color: #888; font-size: 14px; margin-bottom: 32px; line-height: 1.5; }
    .widget { display: flex; justify-content: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to SlopIt</h1>
    <p>Use your Telegram account to continue</p>
    <div class="widget">
      <script async
        src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login="${BOT_USERNAME}"
        data-size="large"
        data-auth-url="${ISSUER}/callback?${callbackParams}"
        data-request-access="write">
      </script>
    </div>
  </div>
</body>
</html>`);
});

// Callback — Telegram redirects here with signed user data
app.get('/callback', (req, res) => {
  const {
    redirect_uri, state, nonce,
    hash, id, first_name, last_name, username, photo_url, auth_date,
  } = req.query;

  if (!redirect_uri) return res.status(400).send('Missing redirect_uri');
  if (!hash || !id)  return res.status(400).send('Missing Telegram data');

  const telegramData = { id, first_name, last_name, username, photo_url, auth_date, hash };
  Object.keys(telegramData).forEach(k => !telegramData[k] && delete telegramData[k]);

  if (!verifyTelegramData(telegramData)) {
    return res.status(401).send(`
      <html><body style="background:#0f0f1a;color:#f44;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;">
        <div style="text-align:center"><h2>Authentication failed</h2><p>Telegram signature invalid or expired. Please try again.</p></div>
      </body></html>
    `);
  }

  const code = nanoid(32);
  codeStore.set(code, {
    user: { id, first_name, last_name, username, photo_url },
    nonce: nonce || '',
    expires: Date.now() + 5 * 60 * 1000,
  });

  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(302, url.toString());
});

// Token exchange
app.post('/token', async (req, res) => {
  const { grant_type, code, client_id } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  if (!code) {
    return res.status(400).json({ error: 'missing_code' });
  }

  const data = codeStore.get(code);
  if (!data || data.expires < Date.now()) {
    codeStore.delete(code);
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired or not found' });
  }
  codeStore.delete(code); // single-use

  const { user, nonce } = data;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const aud  = client_id || OIDC_CLIENT_ID;

  const claims = {
    sub:                `telegram|${user.id}`,
    name:               name || undefined,
    given_name:         user.first_name  || undefined,
    family_name:        user.last_name   || undefined,
    preferred_username: user.username    || undefined,
    picture:            user.photo_url   || undefined,
    ...(nonce ? { nonce } : {}),
  };

  const idToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'telegram-oidc-1' })
    .setIssuer(ISSUER)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  res.json({
    access_token: idToken,
    token_type:   'Bearer',
    expires_in:   3600,
    id_token:     idToken,
  });
});

// Userinfo
app.get('/userinfo', async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const { payload } = await jwtVerify(token, publicKey, { issuer: ISSUER });
    res.json({
      sub:                payload.sub,
      name:               payload.name,
      given_name:         payload.given_name,
      family_name:        payload.family_name,
      preferred_username: payload.preferred_username,
      picture:            payload.picture,
    });
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Telegram OIDC proxy running on :${PORT}`);
  console.log(`OIDC discovery: ${ISSUER}/.well-known/openid-configuration`);
});
