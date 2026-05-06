import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../hooks/useSession.js";

export const ProtectedRoute = ({ children }) => {
  const { session, isPending } = useSession();
  const location = useLocation();

  console.debug("[auth] ProtectedRoute:check", {
    path: location.pathname,
    isPending,
    hasSession: Boolean(session),
    username: session?.user?.username,
  });

  if (isPending) return <div>Loading...</div>;
  if (!session) {
    console.warn("[auth] ProtectedRoute:redirect-to-login", {
      from: location.pathname,
    });
    return (
      <Navigate
        to="/login"
        replace
        state={{
          authStatus: "error",
          authMessage: "Authentication required. Please sign in to continue.",
          from: location.pathname,
        }}
      />
    );
  }

  return <>{children}</>;
};
