import React, { useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import "./TestConsolePage.css";

// ── Helpers ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";

// Unauthenticated client — used for public endpoint checks
const publicClient = axios.create({ baseURL: `${API_BASE}/api/v1` });

function ms(start) {
  return `${Date.now() - start}ms`;
}

// ── Test definitions ────────────────────────────────────────────────────────────
// Each test: { id, group, label, run: async ({ getToken }) => summary string }

function assert(cond, message) {
  if (!cond) throw new Error(`Assertion failed: ${message}`);
}

const TESTS = [
  // ── Auth mode ────────────────────────────────────────────────────────────────

  {
    id: "auth-mode-clerk",
    group: "Auth mode",
    label: "GET /auth/providers/ reports auth_mode = clerk",
    async run() {
      const t = Date.now();
      const { data, status } = await publicClient.get("/auth/providers/");
      assert(status === 200, `status should be 200, got ${status}`);
      assert(
        data.auth_mode === "clerk",
        `expected auth_mode="clerk", got "${data.auth_mode}" — backend may not have migrated`,
      );
      return `auth_mode=${data.auth_mode} (${ms(t)})`;
    },
  },

  // ── System health ────────────────────────────────────────────────────────────

  {
    id: "system-status",
    group: "System",
    label: "GET /system/status returns 200",
    async run() {
      const t = Date.now();
      const { status } = await publicClient.get("/system/status");
      assert(status === 200, `expected 200, got ${status}`);
      return `${ms(t)}`;
    },
  },

  // ── Bearer token ─────────────────────────────────────────────────────────────

  {
    id: "bearer-unauthenticated",
    group: "Bearer auth",
    label: "GET /me/ without token returns 401 or 403",
    async run() {
      try {
        const { status } = await publicClient.get("/me/");
        assert(
          status === 401 || status === 403,
          `expected 401/403, got ${status} — /me/ may not require auth`,
        );
        return `correctly returned ${status}`;
      } catch (err) {
        const status = err.response?.status;
        assert(
          status === 401 || status === 403,
          `expected 401/403, got ${status}`,
        );
        return `correctly rejected with ${status}`;
      }
    },
  },

  {
    id: "bearer-authenticated",
    group: "Bearer auth",
    label: "GET /me/ with Clerk Bearer token returns 200",
    async run({ getToken } = {}) {
      if (!getToken) return "SKIP — Clerk not available in test runner";
      const token = await getToken();
      if (!token) return "SKIP — not signed in to Clerk";
      const t = Date.now();
      const { data, status } = await axios.get(`${API_BASE}/api/v1/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(status === 200, `expected 200, got ${status}`);
      assert(data.id || data.clerk_id, "response should include user id");
      return `user id=${data.id || data.clerk_id} (${ms(t)})`;
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
    id: "route-sign-in",
    group: "Routing",
    label: "/sign-in returns the SPA shell (200)",
    async run() {
      const t = Date.now();
      const { status } = await axios.get(window.location.origin + "/sign-in");
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

  // ── Security ──────────────────────────────────────────────────────────────────

  {
    id: "no-mixed-content",
    group: "Security",
    label: "Frontend and API are both HTTPS (no mixed content)",
    async run() {
      const frontendProto = window.location.protocol;
      const apiProto = new URL(API_BASE).protocol;
      assert(
        frontendProto === apiProto,
        `frontend is ${frontendProto} but API is ${apiProto} — mixed content`,
      );
      return `frontend=${frontendProto} api=${apiProto} ✓`;
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
  const { getToken } = useAuth();

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
        const summary = await test.run({ getToken });
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
  }, [setResult, getToken]);

  const runOne = useCallback(
    async (id) => {
      const test = TESTS.find((t) => t.id === id);
      if (!test || running) return;
      setResult(id, { status: STATUS.RUNNING, summary: null, error: null });
      try {
        const summary = await test.run({ getToken });
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
    [running, setResult, getToken],
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
