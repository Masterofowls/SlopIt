import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

export const ProtectedRoute = ({ children }) => {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) {
    return (
      <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
    );
  }

  return <>{children}</>;
};
