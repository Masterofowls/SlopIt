import express from "express";
import crypto from "crypto";
import { SignJWT, jwtVerify, exportJWK, importPKCS8, importSPKI } from "jose";
import { nanoid } from "nanoid";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Env vars ──────────────────────────────────────────────────────────────────
const {
  BOT_TOKEN, // from BotFather
  BOT_USERNAME, // without @ e.g. "SlopItBot"
  ISSUER, // https://slopit-telegram-oidc.fly.dev
  OIDC_CLIENT_ID, // must match what you put in Clerk
  PORT = "8080",
  JWT_PRIVATE_KEY, // RSA PEM, newlines as \n
  JWT_PUBLIC_KEY, // RSA PEM, newlines as \n
} = process.env;

const REQUIRED = [
  "BOT_TOKEN",
  "BOT_USERNAME",
  "ISSUER",
  "OIDC_CLIENT_ID",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

// ── Load RSA keys ─────────────────────────────────────────────────────────────
const privateKey = await importPKCS8(
  JWT_PRIVATE_KEY.replace(/\\n/g, "\n"),
  "RS256",
);
const publicKey = await importSPKI(
  JWT_PUBLIC_KEY.replace(/\\n/g, "\n"),
  "RS256",
);
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "telegram-oidc-1";
publicJwk.use = "sig";
publicJwk.alg = "RS256";

// ── In-memory auth code store ─────────────────────────────────────────────────
// { code -> { user, nonce, expires } }
const codeStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of codeStore) if (v.expires < now) codeStore.delete(k);
}, 60_000);

// ── In-memory pending auth store (bot deep-link flow) ─────────────────────────
// { loginToken -> { redirect_uri, state, nonce, status, user?, expires } }
const pendingAuths = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingAuths)
    if (v.expires < now) pendingAuths.delete(k);
}, 60_000);

// Webhook secret to verify calls are from Telegram
const WEBHOOK_SECRET = crypto.randomBytes(32).toString("hex");

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (_, res) => res.json({ ok: true }));

// OIDC Discovery
app.get("/.well-known/openid-configuration", (_, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
      "none",
    ],
    claims_supported: [
      "sub",
      "iss",
      "aud",
      "iat",
      "exp",
      "nonce",
      "name",
      "given_name",
      "family_name",
      "picture",
      "preferred_username",
    ],
  });
});

// JWKS
app.get("/.well-known/jwks.json", (_, res) => {
  res.json({ keys: [publicJwk] });
});

// Authorization — bot deep-link flow (replaces deprecated oauth.telegram.org widget)
app.get("/authorize", (req, res) => {
  const { redirect_uri, state = "", nonce = "" } = req.query;
  if (!redirect_uri) return res.status(400).send("Missing redirect_uri");

  const loginToken = nanoid(32);
  pendingAuths.set(loginToken, {
    redirect_uri,
    state,
    nonce,
    status: "pending",
    expires: Date.now() + 10 * 60 * 1000, // 10 min window
  });

  const telegramUrl = `https://t.me/${BOT_USERNAME}?start=${loginToken}`;
  const safeToken = JSON.stringify(loginToken);
  const safeStatus = JSON.stringify(`${ISSUER}/auth-status`);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in with Telegram</title>
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
      max-width: 380px;
      width: 90%;
      box-shadow: 0 24px 48px rgba(0,0,0,0.4);
    }
    h1 { color: #fff; font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { color: #888; font-size: 14px; margin-bottom: 32px; line-height: 1.5; }
    .tg-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #229ED9;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 28px;
      border-radius: 10px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .tg-btn:hover { background: #1a8bc4; }
    .tg-btn svg { flex-shrink: 0; }
    .status {
      margin-top: 28px;
      font-size: 13px;
      color: #666;
      min-height: 20px;
    }
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid #444;
      border-top-color: #229ED9;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to SlopIt</h1>
    <p>Tap the button below to open Telegram and confirm your identity.</p>
    <a class="tg-btn" href="${telegramUrl}" target="_blank" rel="noopener" id="tgLink">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-2.008 9.463c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.96 14.6l-2.965-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.959l-.64-.001z"/>
      </svg>
      Open Telegram
    </a>
    <div class="status" id="statusMsg">
      Waiting for you to confirm in Telegram…
    </div>
  </div>
  <script>
    var loginToken  = ${safeToken};
    var statusUrl   = ${safeStatus};
    var pollHandle;

    // After the link is clicked, start polling
    document.getElementById('tgLink').addEventListener('click', function() {
      document.getElementById('statusMsg').innerHTML =
        '<span class="spinner"></span>Waiting for Telegram confirmation…';
      startPolling();
    });

    // Also start polling after 3 s in case user already confirmed
    setTimeout(startPolling, 3000);

    function startPolling() {
      if (pollHandle) return; // already polling
      pollHandle = setInterval(poll, 2000);
    }

    function poll() {
      fetch(statusUrl + '?token=' + encodeURIComponent(loginToken))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.status === 'complete') {
            clearInterval(pollHandle);
            document.getElementById('statusMsg').innerHTML =
              '<span class="spinner"></span>Signed in! Redirecting…';
            window.location.href = data.redirectUrl;
          } else if (data.status === 'expired') {
            clearInterval(pollHandle);
            document.getElementById('statusMsg').textContent =
              'Login session expired. Please close this and try again.';
          }
        })
        .catch(function() { /* network hiccup, keep polling */ });
    }
  </script>
</body>
</html>`);
});

// Auth status — polled by the authorize page
app.get("/auth-status", (req, res) => {
  const { token } = req.query;
  const auth = pendingAuths.get(token);
  if (!auth) return res.json({ status: "expired" });
  if (auth.status === "pending") return res.json({ status: "pending" });

  // Complete — create OIDC code and build redirect URL
  const code = nanoid(32);
  codeStore.set(code, {
    user: auth.user,
    nonce: auth.nonce,
    expires: Date.now() + 5 * 60 * 1000,
  });

  const url = new URL(auth.redirect_uri);
  url.searchParams.set("code", code);
  if (auth.state) url.searchParams.set("state", auth.state);

  pendingAuths.delete(token);
  res.json({ status: "complete", redirectUrl: url.toString() });
});

// Telegram Bot webhook — called by Telegram when user sends /start <token> to the bot
app.post("/telegram-webhook", (req, res) => {
  // Verify this is from Telegram
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: "forbidden" });
  }

  // Always respond immediately so Telegram doesn't retry
  res.json({ ok: true });

  const update = req.body;
  const message = update.message || update.edited_message;
  if (!message?.text) return;

  const text = message.text.trim();
  // Handles "/start TOKEN" (with or without @botname suffix)
  const match = text.match(/^\/start(?:@\S+)?\s+(\S+)/);
  if (!match) return;

  const loginToken = match[1];
  const auth = pendingAuths.get(loginToken);
  if (!auth || auth.status !== "pending") return;

  const tgUser = message.from;

  // Fetch profile photo asynchronously — resolve file_path then build CDN URL
  const resolvePhotoUrl = async (userId) => {
    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`,
      );
      const photos = await photosRes.json();
      const fileId = photos?.result?.photos?.[0]?.[0]?.file_id;
      if (!fileId) return "";

      const fileRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
      );
      const fileData = await fileRes.json();
      const filePath = fileData?.result?.file_path;
      if (!filePath) return "";

      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    } catch {
      return "";
    }
  };

  resolvePhotoUrl(tgUser.id).then((photo_url) => {
    auth.status = "complete";
    auth.user = {
      id: String(tgUser.id),
      first_name: tgUser.first_name || "",
      last_name: tgUser.last_name || "",
      username: tgUser.username || "",
      photo_url,
    };
  });

  // Send a confirmation message back in the bot chat
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: tgUser.id,
      text: "✅ You're signed in to SlopIt! You can now close Telegram and return to the app.",
    }),
  }).catch(() => {});
});

// Token exchange
app.post("/token", async (req, res) => {
  const { grant_type, code, client_id } = req.body;

  if (grant_type !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }
  if (!code) {
    return res.status(400).json({ error: "missing_code" });
  }

  const data = codeStore.get(code);
  if (!data || data.expires < Date.now()) {
    codeStore.delete(code);
    return res
      .status(400)
      .json({
        error: "invalid_grant",
        error_description: "Code expired or not found",
      });
  }
  codeStore.delete(code); // single-use

  const { user, nonce } = data;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const aud = client_id || OIDC_CLIENT_ID;

  const claims = {
    sub: `telegram|${user.id}`,
    name: name || undefined,
    given_name: user.first_name || undefined,
    family_name: user.last_name || undefined,
    preferred_username: user.username || undefined,
    picture: user.photo_url || undefined,
    ...(nonce ? { nonce } : {}),
  };

  const idToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "telegram-oidc-1" })
    .setIssuer(ISSUER)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  res.json({
    access_token: idToken,
    token_type: "Bearer",
    expires_in: 3600,
    id_token: idToken,
  });
});

// Userinfo
app.get("/userinfo", async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    const { payload } = await jwtVerify(token, publicKey, { issuer: ISSUER });
    res.json({
      sub: payload.sub,
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      preferred_username: payload.preferred_username,
      picture: payload.picture,
    });
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Telegram OIDC proxy running on :${PORT}`);
  console.log(`OIDC discovery: ${ISSUER}/.well-known/openid-configuration`);

  // Register bot webhook with Telegram so we receive /start <token> messages
  const webhookUrl = `${ISSUER}/telegram-webhook`;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: WEBHOOK_SECRET,
          allowed_updates: ["message"],
        }),
      },
    );
    const data = await r.json();
    if (data.ok) {
      console.log(`Bot webhook registered: ${webhookUrl}`);
    } else {
      console.error("Failed to register bot webhook:", data);
    }
  } catch (err) {
    console.error("Error registering bot webhook:", err.message);
  }
});
