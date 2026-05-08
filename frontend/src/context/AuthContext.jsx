import React, { createContext, useContext, useEffect, useState } from "react";
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
  provider: null, // 'clerk' | 'telegram' | null
  isAuthenticated: false,
  isLoading: true,
  telegramUser: null, // populated only for Telegram sessions
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const { isSignedIn: clerkSignedIn, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const [telegramUser, setTelegramUser] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);

  // Only probe the session endpoint when Clerk says "not signed in".
  // This avoids an unnecessary request for Clerk users.
  useEffect(() => {
    if (!clerkLoaded) return;
    if (clerkSignedIn) {
      setTelegramLoading(false);
      return;
    }

    api
      .get("/auth/session/")
      .then(({ data }) => {
        if (data.authenticated && data.user) {
          setTelegramUser({
            id: data.user.id,
            username: data.user.username,
            email: data.user.email ?? "",
            firstName: data.user.first_name ?? "",
            lastName: data.user.last_name ?? "",
            avatarUrl: data.user.avatar_url ?? null,
          });
        }
      })
      .catch(() => {
        // No active Telegram session — that's fine
      })
      .finally(() => setTelegramLoading(false));
  }, [clerkLoaded, clerkSignedIn]);

  const logout = async () => {
    if (clerkSignedIn) {
      await clerkSignOut();
    } else {
      await api.post("/auth/logout/").catch(() => {});
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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Provider-agnostic auth hook. */
export const useAuthContext = () => useContext(AuthContext);
