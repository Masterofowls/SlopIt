import { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = authService.getToken();
      const userData = authService.getUser();

      if (token && userData) {
        setIsAuthenticated(true);
        setUser(userData);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);
      setIsAuthenticated(true);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setError(null);
  }, []);

  const signup = useCallback(async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.signup(userData);
      setIsAuthenticated(true);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    logout,
    signup
  };
};

export default useAuth;
