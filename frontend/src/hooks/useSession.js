import { useState, useEffect } from 'react';
import api from '../lib/api.js';

export function useSession() {
  const [session, setSession] = useState(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await api.get('/session');
        setSession(response.data);
      } catch (err) {
        setError(err);
        setSession(null);
      } finally {
        setIsPending(false);
      }
    };

    fetchSession();
  }, []);

const login = async (credentials) => {
  const response = await api.post('/login', credentials);
  setSession(response.data);
  return response.data;
};

const logout = async () => {
  await api.post('/logout');
  setSession(null);
};

  return {
    session,
    isPending,
    error,
    login,
    logout
  };
}
