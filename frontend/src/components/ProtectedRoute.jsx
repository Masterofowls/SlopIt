import { useAuthContext } from "../context/AuthContext";
import AuthPage from "../pages/AuthPage";

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <AuthPage />;

  return <>{children}</>;
};
