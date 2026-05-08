/**
 * Tests for src/lib/api.js — axios instance and CSRF interceptor
 *
 * Covers:
 *  - api instance is created with correct baseURL and withCredentials
 *  - CSRF interceptor adds X-CSRFToken on mutating methods (POST, PUT, PATCH, DELETE)
 *  - CSRF interceptor skips X-CSRFToken on safe methods (GET, HEAD, OPTIONS)
 *  - CSRF interceptor skips header when csrftoken cookie is absent
 *  - apiFetchWithToken adds Authorization: Bearer header
 *  - apiFetchWithToken omits Authorization when token is null
 *  - apiFetchWithToken throws parsed error body on non-ok response
 *  - apiFetchWithToken falls back to statusText when body is not JSON
 */

// api.js imports useAuth from Clerk only inside hooks (not at module-level call),
// but we mock the module to satisfy the import statement.
jest.mock("@clerk/clerk-react", () => ({
  useAuth: jest.fn(),
}));

import { api, apiFetchWithToken } from "../../src/lib/api.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the fulfilled function of the first non-null interceptor registered
 * on api.interceptors.request (the CSRF interceptor added at module load time).
 */
function getCsrfInterceptorFn() {
  const handler = api.interceptors.request.handlers.find((h) => h !== null);
  if (!handler) throw new Error("CSRF interceptor not found");
  return handler.fulfilled;
}

/** Override document.cookie getter for a single test. */
function mockCookie(value) {
  Object.defineProperty(document, "cookie", {
    get: jest.fn().mockReturnValue(value),
    configurable: true,
  });
}

afterEach(() => {
  Object.defineProperty(document, "cookie", {
    get: () => "",
    configurable: true,
  });
});

// ── api instance config ────────────────────────────────────────────────────────

describe("api axios instance", () => {
  it("is created with withCredentials: true", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("baseURL ends with /api/v1", () => {
    expect(api.defaults.baseURL).toMatch(/\/api\/v1$/);
  });

  it("default Content-Type is application/json", () => {
    expect(api.defaults.headers["Content-Type"]).toBe("application/json");
  });
});

// ── CSRF interceptor ───────────────────────────────────────────────────────────

describe("CSRF request interceptor", () => {
  it("adds X-CSRFToken on POST when cookie is present", () => {
    mockCookie("csrftoken=secretcsrf");
    const config = { method: "post", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBe("secretcsrf");
  });

  it("adds X-CSRFToken on PUT", () => {
    mockCookie("csrftoken=puttoken");
    const config = { method: "put", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBe("puttoken");
  });

  it("adds X-CSRFToken on PATCH", () => {
    mockCookie("csrftoken=patchtoken");
    const config = { method: "patch", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBe("patchtoken");
  });

  it("adds X-CSRFToken on DELETE", () => {
    mockCookie("csrftoken=deletetoken");
    const config = { method: "delete", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBe("deletetoken");
  });

  it("does NOT add X-CSRFToken on GET", () => {
    mockCookie("csrftoken=shouldbeignored");
    const config = { method: "get", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("does NOT add X-CSRFToken on HEAD", () => {
    mockCookie("csrftoken=shouldbeignored");
    const config = { method: "head", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("does NOT add X-CSRFToken on OPTIONS", () => {
    mockCookie("csrftoken=shouldbeignored");
    const config = { method: "options", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("skips header when csrftoken cookie is absent", () => {
    mockCookie("other=value");
    const config = { method: "post", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("URI-decodes the cookie value", () => {
    mockCookie("csrftoken=hello%20world");
    const config = { method: "post", headers: {} };
    const result = getCsrfInterceptorFn()(config);
    expect(result.headers["X-CSRFToken"]).toBe("hello world");
  });

  it("returns the same config object (not a copy)", () => {
    mockCookie("");
    const config = { method: "get", headers: {} };
    expect(getCsrfInterceptorFn()(config)).toBe(config);
  });
});

// ── apiFetchWithToken ──────────────────────────────────────────────────────────

describe("apiFetchWithToken()", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("adds Authorization: Bearer header when token is provided", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: "ok" }),
    });

    await apiFetchWithToken("/api/v1/posts", "mytoken");

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer mytoken");
  });

  it("omits Authorization header when token is null", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiFetchWithToken("/api/v1/posts", null);

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("returns parsed JSON on success", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ posts: [] }),
    });

    const result = await apiFetchWithToken("/api/v1/posts", "tok");
    expect(result).toEqual({ posts: [] });
  });

  it("throws parsed error body on non-ok response", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      statusText: "Not Found",
      json: () => Promise.resolve({ error: "not found" }),
    });

    await expect(apiFetchWithToken("/api/v1/posts", "tok")).rejects.toEqual({
      error: "not found",
    });
  });

  it("throws statusText fallback when response body is not JSON", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new SyntaxError("bad json")),
    });

    await expect(apiFetchWithToken("/api/v1/posts", "tok")).rejects.toEqual({
      error: "Internal Server Error",
    });
  });
});
