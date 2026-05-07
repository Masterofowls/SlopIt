import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder required by react-router v7 in jsdom
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// ── Console spy: fail on unexpected console.error calls ─────────────────────
// Store originals before tests tamper with them
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  // Suppress React's act() warnings for tests that deliberately fire them
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const msg = args[0];
    // Allow known-safe messages
    if (
      typeof msg === "string" &&
      (msg.includes("Warning: An update to") ||
        msg.includes("Warning: ReactDOM.render") ||
        msg.includes("Not implemented: navigation") ||
        msg.includes("Error: connect ECONNREFUSED"))
    ) {
      return;
    }
    // jsdom navigation errors arrive as Error objects (not strings) from the
    // virtualConsole -- check message directly since instanceof may fail across realms
    if (
      msg &&
      typeof msg.message === "string" &&
      msg.message.includes("Not implemented:")
    ) {
      return;
    }
    originalError(...args);
  });

  jest.spyOn(console, "warn").mockImplementation((...args) => {
    const msg = args[0];
    if (typeof msg === "string" && msg.includes("[auth]")) {
      return; // auth debug noise
    }
    originalWarn(...args);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── JSDOM missing APIs ────────────────────────────────────────────────────────
// jsdom window.location is non-configurable and non-writable; we cannot replace
// it or redefine its properties. Tests that need to verify navigation should
// spy on console.info (auth.js logs the target URL before navigating) rather
// than reading window.location.href, because jsdom's navigation is not
// implemented so the href value never actually changes.

// sessionStorage mock (JSDOM has it but some envs don't)
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});
