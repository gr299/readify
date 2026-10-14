import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user);
      if (!data.user) {
        localStorage.removeItem('readify_token');
      }
    } catch {
      localStorage.removeItem('readify_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email, password) => {
      const data = await api.post('/api/auth/login', { email, password });
      if (data.token) {
        localStorage.setItem('readify_token', data.token);
      }
      setUser(data.user);
      return data.user;
    },
    []
  );

  const register = useCallback(
    async (name, email, password) => {
      const data = await api.post('/api/auth/register', { name, email, password });
      if (data.token) {
        localStorage.setItem('readify_token', data.token);
      }
      setUser(data.user);
      return data.user;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('readify_token');
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
