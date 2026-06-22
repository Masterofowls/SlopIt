import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useUser, useClerk, useAuth } from "@clerk/clerk-react";
import { api } from "../lib/api";

function mapSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? "",
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    displayName:
      user.display_name ?? user.profile?.display_name ?? user.first_name ?? "",
    avatarUrl: user.avatar_url ?? null,
    authMethod: user.auth_method ?? "",
  };
}

function providerFromSessionUser(sessionUser) {
  if (!sessionUser) return null;
  if (sessionUser.authMethod === "password") return "password";
  if (sessionUser.authMethod === "telegram") return "telegram";
  return "session";
}

const AuthContext = createContext({
  provider: null,
  isAuthenticated: false,
  isLoading: true,
  sessionUser: null,
  telegramUser: null,
  clerkProfile: null,
  authLogs: [],
  refreshSession: async () => {},
  logout: async () => {},
  hasConsented: false,
  grantConsent: async () => {},
});

export function AuthProvider({ children }) {
  const {
    isSignedIn: clerkSignedIn,
    isLoaded: clerkLoaded,
    user: clerkUser,
  } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const { getToken } = useAuth();

  const [sessionUser, setSessionUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [clerkProfile, setClerkProfile] = useState(null);
  const [authLogs, setAuthLogs] = useState([]);
  const sessionProbeRef = useRef(0);
  const [hasConsented, setHasConsented] = useState(() => {
    return localStorage.getItem("slopit_data_consent") === "true";
  });

  const grantConsent = useCallback((isGranted) => {
    setHasConsented(isGranted);
    localStorage.setItem("slopit_data_consent", isGranted);
  }, []);

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
    if (!clerkLoaded || !clerkSignedIn) return;
    let cancelled = false;
    addLog("Clerk signed in — fetching backend profile from /me/");
    setSessionLoading(false);

    getToken()
      .then((token) => {
        if (!token || cancelled) return;
        return api.get("/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => {
        if (!res || cancelled) return;
        const d = res.data;
        addLog("GET /me/ success", d);
        const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
        const isClerkId = (s) =>
          typeof s === "string" && /^(clerk_|k_)?user_[a-z0-9]{6,}/i.test(s);
        const clerkName =
          clerkUser?.fullName ||
          clerkUser?.firstName ||
          (!isClerkId(clerkUser?.username) ? clerkUser?.username : null) ||
          (clerkEmail ? clerkEmail.split("@")[0] : null);
        const backendName =
          d.display_name ||
          d.username ||
          (d.email ? d.email.split("@")[0] : null);
        setClerkProfile({
          username: d.username ?? null,
          email: clerkEmail ?? d.email ?? null,
          displayName: backendName || clerkName || null,
          avatarUrl:
            clerkUser?.imageUrl ?? d.avatar_url ?? d.social_avatar_url ?? null,
          bio: d.bio ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        addLog("GET /me/ ERROR", {
          message: err.message,
          status: err.response?.status,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, clerkSignedIn, clerkUser, getToken]);

  const refreshSession = useCallback(async () => {
    const probeId = ++sessionProbeRef.current;
    addLog("Probing /auth/session/");
    try {
      const { data, status } = await api.get("/auth/session/");
      if (probeId !== sessionProbeRef.current) return data;
      addLog("GET /auth/session/ " + status, data);
      if (data.authenticated && data.user) {
        const mapped = mapSessionUser(data.user);
        addLog("Session user found", mapped);
        setSessionUser(mapped);
      } else {
        setSessionUser(null);
      }
      return data;
    } catch (err) {
      if (probeId !== sessionProbeRef.current) return null;
      addLog("GET /auth/session/ ERROR", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setSessionUser(null);
      return null;
    } finally {
      if (probeId === sessionProbeRef.current) {
        setSessionLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!clerkLoaded) return;
    if (clerkSignedIn) {
      setSessionUser(null);
      return;
    }
    setSessionLoading(true);
    refreshSession();
  }, [clerkLoaded, clerkSignedIn, refreshSession]);

  const logout = async () => {
    if (clerkSignedIn) {
      addLog("Logging out Clerk user");
      setClerkProfile(null);
      await clerkSignOut();
    } else {
      addLog("Logging out session user");
      await api
        .post("/auth/logout/")
        .catch((err) => addLog("POST /auth/logout/ ERROR", err.message));
      setSessionUser(null);
    }
  };

  const isLoading = !clerkLoaded || sessionLoading;
  const provider = clerkSignedIn
    ? "clerk"
    : providerFromSessionUser(sessionUser);

  return (
    <AuthContext.Provider
      value={{
        provider,
        isAuthenticated: !!provider,
        isLoading,
        sessionUser,
        telegramUser: sessionUser,
        clerkProfile,
        authLogs,
        refreshSession,
        logout,
        hasConsented,
        grantConsent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
