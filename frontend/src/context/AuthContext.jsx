import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const res = await api.get('/auth/me');
    setUser(res.data.user);
    setCapabilities(res.data.capabilities);
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    loadMe()
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);



    // Another tab logged in or out: reload so this tab shows the same person
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === 'token') window.location.reload();
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    await loadMe();
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    setCapabilities(null);
  }

  return (
    <AuthContext.Provider value={{ user, capabilities, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}