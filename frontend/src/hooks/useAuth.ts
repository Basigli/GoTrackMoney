import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/utils/api';
import { useTheme } from '@/i18n/ThemeContext';

export function useAuth() {
  const { setActiveUser, clearActiveUser } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{id: number, username: string, session_duration_hours: number, is_admin: boolean} | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken);
    } else {
      setLoading(false);
      router.push('/');
    }
  }, []);

  const fetchMe = async (authToken: string) => {
    try {
      // Using imported API_BASE
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const current = await res.json();
        setActiveUser(current.id);
        setUser(current);
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    clearActiveUser();
    setToken(null);
    setUser(null);
    router.push('/');
  };

  return { token, user, loading, logout };
}
