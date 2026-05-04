import { Navigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';

export const ProtectedRoute = ({ children }) => {
  const { session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
