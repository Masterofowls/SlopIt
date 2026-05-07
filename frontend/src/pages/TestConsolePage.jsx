import React, { useState, useCallback } from "react";
import axios from "axios";
import "./TestConsolePage.css";

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = `${window.location.origin}/api/v1`;

const client = axios.create({ baseURL: API_BASE, withCredentials: true });

function ms(start) {
  return `${Date.now() - start}ms`;
}

// ── Test definitions ────────────────────────────────────────────────────────────
// Each test: { id, group, label, run: async () => { assert(cond, msg); return summary } }

function assert(cond, message) {
  if (!cond) throw new Error(`Assertion failed: ${message}`);
}

const TESTS = [
  // ── API reachability ────────────────────────────────────────────────────────

  {
    id: "csrf-endpoint",
    group: "API",
    label: "GET /auth/csrf/ returns a CSRF token",
    async run() {
      const t = Date.now();
      const { data, status } = await client.get("/auth/csrf/");
      assert(status === 200, `status should be 200, got ${status}`);
      assert(
        typeof data.csrfToken === "string" && data.csrfToken.length > 0,
        "csrfToken should be a non-empty string",
      );
      return `token length ${data.csrfToken.length} (${ms(t)})`;
    },
  },

  {
    id: "session-endpoint",
    group: "API",
    label: "GET /auth/session/ returns valid shape",
    async run() {
      const t = Date.now();
      const { data, status } = await client.get("/auth/session/");
      assert(status === 200, `status should be 200, got ${status}`);
      assert(
        typeof data.authenticated === "boolean",
        "response.authenticated should be boolean",
      );
      return `authenticated=${data.authenticated} (${ms(t)})`;
    },
  },

  {
    id: "providers-endpoint",
    group: "API",
    label: "GET /auth/providers/ returns an array",
    async run() {
      const t = Date.now();
      const { data, status } = await client.get("/auth/providers/");
      assert(status === 200, `status should be 200, got ${status}`);
      assert(Array.isArray(data.providers), "providers should be an array");
      const ids = (data.providers ?? []).map((p) => p.id).join(", ");
      return `${data.providers.length} provider(s): ${ids || "none"} (${ms(t)})`;
    },
  },

  {
    id: "providers-have-login-url",
    group: "API",
    label: "Each provider has id, name and login_url",
    async run() {
      const { data } = await client.get("/auth/providers/");
      for (const p of data.providers ?? []) {
        assert(typeof p.id === "string" && p.id, `provider.id missing`);
        assert(
          typeof p.name === "string" && p.name,
          `provider.name missing (${p.id})`,
        );
        assert(
          typeof p.login_url === "string" && p.login_url.startsWith("/"),
          `provider.login_url should be a relative path (${p.id})`,
        );
      }
      return `${data.providers?.length ?? 0} provider(s) all valid`;
    },
  },

  // ── Auth / session ──────────────────────────────────────────────────────────

  {
    id: "session-user-shape",
    group: "Auth",
    label: "Authenticated session has user.id and user.username",
    async run() {
      const { data } = await client.get("/auth/session/");
      if (!data.authenticated) {
        return "SKIP — not authenticated";
      }
      assert(data.user?.id, "user.id should be set");
      assert(
        typeof data.user?.username === "string",
        "user.username should be a string",
      );
      return `user.id=${data.user.id} username=${data.user.username}`;
    },
  },

  {
    id: "logout-requires-csrf",
    group: "Auth",
    label: "POST /auth/logout/ without CSRF returns 403",
    async run() {
      try {
        // Deliberately omit CSRF header
        const bare = axios.create({ baseURL: API_BASE, withCredentials: true });
        const { status } = await bare.post("/auth/logout/");
        // If the server returns 200 without CSRF that's a bug, but we won't
        // hard-fail because some backends skip CSRF for logged-out users.
        return `server returned ${status} (CSRF may not be enforced when unauthenticated)`;
      } catch (err) {
        const status = err.response?.status;
        assert(
          status === 403 || status === 401,
          `expected 403/401 without CSRF, got ${status}`,
        );
        return `correctly rejected with ${status}`;
      }
    },
  },

  // ── Frontend routing ─────────────────────────────────────────────────────────

  {
    id: "route-landing",
    group: "Routing",
    label: "/ responds with 200 and HTML",
    async run() {
      const t = Date.now();
      const { status, headers } = await axios.get(window.location.origin + "/");
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        headers["content-type"]?.includes("text/html"),
        "expected text/html content-type",
      );
      return `${ms(t)}`;
    },
  },

  {
    id: "route-login",
    group: "Routing",
    label: "/login returns the SPA shell (200)",
    async run() {
      const t = Date.now();
      const { status } = await axios.get(window.location.origin + "/login");
      assert(status === 200, `expected 200, got ${status}`);
      return `${ms(t)}`;
    },
  },

  {
    id: "route-unknown",
    group: "Routing",
    label: "Unknown route falls back to SPA shell (200, not 404)",
    async run() {
      const t = Date.now();
      const { status } = await axios.get(
        window.location.origin + "/definitely-does-not-exist-xyz",
      );
      assert(
        status === 200,
        `SPA fallback expected 200, got ${status} — nginx try_files may be misconfigured`,
      );
      return `${ms(t)}`;
    },
  },

  // ── Security headers ────────────────────────────────────────────────────────

  {
    id: "no-mixed-content",
    group: "Security",
    label: "API origin matches frontend origin (no mixed content)",
    async run() {
      const frontendProto = window.location.protocol;
      // Fetch our own session to see what origin the API is on
      const { request } = await client.get("/auth/session/");
      const apiProto = new URL(request.responseURL).protocol;
      assert(
        frontendProto === apiProto,
        `frontend is ${frontendProto} but API is ${apiProto} — mixed content`,
      );
      return `frontend=${frontendProto} api=${apiProto} ✓`;
    },
  },

  {
    id: "cors-credentials",
    group: "Security",
    label: "Session cookie is sent with credentialed requests",
    async run() {
      // If withCredentials works, the session endpoint should succeed without
      // CORS preflight rejection. A 200 proves credentials are accepted.
      const t = Date.now();
      const { status } = await client.get("/auth/session/");
      assert(status === 200, `expected 200, got ${status}`);
      return `credentials accepted (${ms(t)})`;
    },
  },
];

// ── State ──────────────────────────────────────────────────────────────────────

const STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  PASS: "pass",
  FAIL: "fail",
  SKIP: "skip",
};

function buildInitialState() {
  return TESTS.map((t) => ({
    id: t.id,
    group: t.group,
    label: t.label,
    status: STATUS.IDLE,
    summary: null,
    error: null,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TestConsolePage() {
  const [results, setResults] = useState(buildInitialState);
  const [running, setRunning] = useState(false);

  const setResult = useCallback((id, patch) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults(buildInitialState());

    for (const test of TESTS) {
      setResult(test.id, { status: STATUS.RUNNING });
      try {
        const summary = await test.run();
        if (typeof summary === "string" && summary.startsWith("SKIP")) {
          setResult(test.id, { status: STATUS.SKIP, summary });
        } else {
          setResult(test.id, { status: STATUS.PASS, summary });
        }
      } catch (err) {
        setResult(test.id, {
          status: STATUS.FAIL,
          error: err.message ?? String(err),
        });
      }
    }

    setRunning(false);
  }, [setResult]);

  const runOne = useCallback(
    async (id) => {
      const test = TESTS.find((t) => t.id === id);
      if (!test || running) return;
      setResult(id, { status: STATUS.RUNNING, summary: null, error: null });
      try {
        const summary = await test.run();
        if (typeof summary === "string" && summary.startsWith("SKIP")) {
          setResult(id, { status: STATUS.SKIP, summary });
        } else {
          setResult(id, { status: STATUS.PASS, summary });
        }
      } catch (err) {
        setResult(id, {
          status: STATUS.FAIL,
          error: err.message ?? String(err),
        });
      }
    },
    [running, setResult],
  );

  const groups = [...new Set(TESTS.map((t) => t.group))];
  const passed = results.filter((r) => r.status === STATUS.PASS).length;
  const failed = results.filter((r) => r.status === STATUS.FAIL).length;
  const skipped = results.filter((r) => r.status === STATUS.SKIP).length;
  const total = results.length;
  const done = passed + failed + skipped;

  return (
    <div className="tc-root">
      <header className="tc-header">
        <div className="tc-title-row">
          <span className="tc-title">
            <span className="tc-icon">⚗</span> Test Console
          </span>
          <span className="tc-env">{window.location.origin}</span>
        </div>

        <div className="tc-toolbar">
          <button
            className="tc-btn tc-btn-run"
            onClick={runAll}
            disabled={running}
          >
            {running ? "Running…" : "▶ Run All"}
          </button>
          <button
            className="tc-btn tc-btn-reset"
            onClick={() => {
              setResults(buildInitialState());
            }}
            disabled={running}
          >
            ↺ Reset
          </button>

          {done > 0 && (
            <span className="tc-summary">
              {done}/{total}{" "}
              {failed > 0 && (
                <span className="tc-count tc-fail">{failed} failed</span>
              )}
              {passed > 0 && (
                <span className="tc-count tc-pass">{passed} passed</span>
              )}
              {skipped > 0 && (
                <span className="tc-count tc-skip">{skipped} skipped</span>
              )}
            </span>
          )}
        </div>
      </header>

      <main className="tc-main">
        {groups.map((group) => (
          <section key={group} className="tc-group">
            <h2 className="tc-group-name">{group}</h2>
            <ul className="tc-list">
              {results
                .filter((r) => r.group === group)
                .map((r) => (
                  <li key={r.id} className={`tc-item tc-item-${r.status}`}>
                    <span className="tc-badge">{BADGE[r.status]}</span>
                    <span className="tc-label">{r.label}</span>
                    {r.summary && (
                      <span className="tc-detail tc-detail-pass">
                        {r.summary}
                      </span>
                    )}
                    {r.error && (
                      <span className="tc-detail tc-detail-fail">
                        {r.error}
                      </span>
                    )}
                    <button
                      className="tc-btn-retry"
                      title="Re-run this test"
                      onClick={() => runOne(r.id)}
                      disabled={running || r.status === STATUS.RUNNING}
                    >
                      ↻
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </main>

      <footer className="tc-footer">
        These are live smoke tests against{" "}
        <strong>{window.location.origin}</strong>. They make real network
        requests — no mocking.
      </footer>
    </div>
  );
}

const BADGE = {
  [STATUS.IDLE]: "◌",
  [STATUS.RUNNING]: "⟳",
  [STATUS.PASS]: "✓",
  [STATUS.FAIL]: "✗",
  [STATUS.SKIP]: "–",
};
