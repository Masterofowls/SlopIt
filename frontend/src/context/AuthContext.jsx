import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { api } from "../lib/api";

/**
 * Unified auth context — covers both Clerk (Google/GitHub/email) and
 * Telegram (session-cookie via Django allauth).
 *
 * Use `useAuthContext()` instead of Clerk's `useAuth()` when you need
 * provider-agnostic auth state.
 */

const AuthContext = createContext({
  provider: null,
  isAuthenticated: false,
  isLoading: true,
  telegramUser: null,
  authLogs: [],
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const { isSignedIn: clerkSignedIn, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [telegramUser, setTelegramUser] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [authLogs, setAuthLogs] = useState([]);

  function addLog(msg, data) {
    const entry = {
      t: new Date().toISOString().slice(11, 23),
      msg,
      data: data !== undefined ? JSON.stringify(data, null, 2) : null,
    };
    console.log(`[AuthContext] ${msg}`, data ?? "");
    setAuthLogs((prev) => [...prev.slice(-49), entry]);
  }

  useEffect(() => {
    addLog("clerkLoaded=" + clerkLoaded + " clerkSignedIn=" + clerkSignedIn);
  }, [clerkLoaded, clerkSignedIn]);

  useEffect(() => {
    if (!clerkLoaded) return;
    if (clerkSignedIn) {
      addLog("Clerk signed in — skipping session probe");
      setTelegramLoading(false);
      return;
    }

    addLog("Clerk not signed in — probing /auth/session/");
    api
      .get("/auth/session/")
      .then(({ data, status }) => {
        addLog("GET /auth/session/ " + status, data);
        if (data.authenticated && data.user) {
          addLog("Telegram session found", data.user);
          setTelegramUser({
            id: data.user.id,
            username: data.user.username,
            email: data.user.email ?? "",
            firstName: data.user.first_name ?? "",
            lastName: data.user.last_name ?? "",
            avatarUrl: data.user.avatar_url ?? null,
          });
        } else {
          addLog("No active session in response", data);
        }
      })
      .catch((err) => {
        const detail = {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        };
        addLog("GET /auth/session/ ERROR", detail);
      })
      .finally(() => setTelegramLoading(false));
  }, [clerkLoaded, clerkSignedIn]);

  const logout = async () => {
    if (clerkSignedIn) {
      addLog("Logging out Clerk user");
      await clerkSignOut();
    } else {
      addLog("Logging out Telegram user");
      await api
        .post("/auth/logout/")
        .catch((err) => addLog("POST /auth/logout/ ERROR", err.message));
      setTelegramUser(null);
    }
  };

  const isLoading = !clerkLoaded || telegramLoading;
  const provider = clerkSignedIn ? "clerk" : telegramUser ? "telegram" : null;

  return (
    <AuthContext.Provider
      value={{
        provider,
        isAuthenticated: !!provider,
        isLoading,
        telegramUser,
        authLogs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Provider-agnostic auth hook. */
export const useAuthContext = () => useContext(AuthContext);
