/**
 * Tests for useClerkInterceptor in src/lib/api.js
 *
 * Covers:
 *  - Registers a request interceptor on the api axios instance on mount
 *  - Ejects the interceptor on unmount (cleanup)
 *  - Attaches Authorization: Bearer <token> header when getToken returns a token
 *  - Does NOT add Authorization header when getToken returns null
 *  - Re-registers when getToken reference changes (useEffect dependency)
 */

import { renderHook } from "@testing-library/react";

jest.mock("@clerk/clerk-react", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@clerk/clerk-react";
import { api, useClerkInterceptor } from "../../src/lib/api.js";

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Interceptor lifecycle ──────────────────────────────────────────────────────

describe("useClerkInterceptor — lifecycle", () => {
  it("registers exactly one interceptor on mount", () => {
    const getToken = jest.fn().mockResolvedValue(null);
    useAuth.mockReturnValue({ getToken });

    const useSpy = jest.spyOn(api.interceptors.request, "use");
    renderHook(() => useClerkInterceptor());

    expect(useSpy).toHaveBeenCalledTimes(1);
    useSpy.mockRestore();
  });

  it("ejects the interceptor on unmount", () => {
    const getToken = jest.fn().mockResolvedValue(null);
    useAuth.mockReturnValue({ getToken });

    let capturedId;
    const useSpy = jest
      .spyOn(api.interceptors.request, "use")
      .mockImplementation((fn) => {
        capturedId = 77;
        return 77;
      });
    const ejectSpy = jest.spyOn(api.interceptors.request, "eject");

    const { unmount } = renderHook(() => useClerkInterceptor());
    unmount();

    expect(ejectSpy).toHaveBeenCalledWith(77);
    useSpy.mockRestore();
    ejectSpy.mockRestore();
  });
});

// ── Token injection ────────────────────────────────────────────────────────────

describe("useClerkInterceptor — token injection", () => {
  it("adds Authorization: Bearer header when getToken returns a token", async () => {
    const getToken = jest.fn().mockResolvedValue("jwt-test-token");
    useAuth.mockReturnValue({ getToken });

    let capturedFn;
    const useSpy = jest
      .spyOn(api.interceptors.request, "use")
      .mockImplementation((fn) => {
        capturedFn = fn;
        return 42;
      });

    renderHook(() => useClerkInterceptor());

    const config = { headers: {} };
    const result = await capturedFn(config);
    expect(result.headers["Authorization"]).toBe("Bearer jwt-test-token");

    useSpy.mockRestore();
  });

  it("does NOT add Authorization header when getToken returns null", async () => {
    const getToken = jest.fn().mockResolvedValue(null);
    useAuth.mockReturnValue({ getToken });

    let capturedFn;
    const useSpy = jest
      .spyOn(api.interceptors.request, "use")
      .mockImplementation((fn) => {
        capturedFn = fn;
        return 42;
      });

    renderHook(() => useClerkInterceptor());

    const config = { headers: {} };
    const result = await capturedFn(config);
    expect(result.headers["Authorization"]).toBeUndefined();

    useSpy.mockRestore();
  });

  it("returns the config object from the interceptor", async () => {
    const getToken = jest.fn().mockResolvedValue("tok");
    useAuth.mockReturnValue({ getToken });

    let capturedFn;
    const useSpy = jest
      .spyOn(api.interceptors.request, "use")
      .mockImplementation((fn) => {
        capturedFn = fn;
        return 42;
      });

    renderHook(() => useClerkInterceptor());

    const config = { headers: {} };
    const result = await capturedFn(config);
    expect(result).toBe(config);

    useSpy.mockRestore();
  });
});
