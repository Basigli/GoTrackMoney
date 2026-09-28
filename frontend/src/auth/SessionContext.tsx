'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '@/utils/api';
import { useTheme } from '@/i18n/ThemeContext';
import type { SessionUser } from '@/types/domain';

type SessionState =
  | { status: 'loading'; token: null; user: null }
  | { status: 'anonymous'; token: null; user: null }
  | { status: 'authenticated'; token: string; user: SessionUser };

type SessionContextValue = {
  session: SessionState;
  authenticate: (mode: 'login' | 'register', username: string, password: string) => Promise<void>;
  updateUser: (user: SessionUser) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading', token: null, user: null });
  const activeToken = useRef<string | null>(null);
  const { setActiveUser, clearActiveUser } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      const token = localStorage.getItem('auth_token');
      if (!token) {
        activeToken.current = null;
        clearActiveUser();
        setSession({ status: 'anonymous', token: null, user: null });
        return;
      }
      if (token !== activeToken.current) {
        setSession({ status: 'loading', token: null, user: null });
      }
      try {
        const user = await apiRequest<SessionUser>('/auth/me', { token, signal: controller.signal });
        if (controller.signal.aborted || localStorage.getItem('auth_token') !== token) return;
        activeToken.current = token;
        setActiveUser(user.id);
        setSession({ status: 'authenticated', token, user });
      } catch {
        if (controller.signal.aborted || localStorage.getItem('auth_token') !== token) return;
        activeToken.current = null;
        localStorage.removeItem('auth_token');
        clearActiveUser();
        setSession({ status: 'anonymous', token: null, user: null });
      }
    });
    return () => controller.abort();
  }, [pathname, setActiveUser, clearActiveUser]);

  useEffect(() => {
    if (session.status === 'anonymous' && pathname !== '/') router.replace('/');
    if (session.status === 'authenticated' && pathname === '/admin' && !session.user.is_admin) router.replace('/');
  }, [session, pathname, router]);

  const authenticate = useCallback(async (mode: 'login' | 'register', username: string, password: string) => {
    const result = await apiRequest<{ token: string; user: SessionUser }>(mode === 'login' ? '/auth/login' : '/users', {
      method: 'POST', body: { username, password },
    });
    localStorage.setItem('auth_token', result.token);
    activeToken.current = result.token;
    setActiveUser(result.user.id);
    setSession({ status: 'authenticated', token: result.token, user: result.user });
  }, [setActiveUser]);

  const updateUser = useCallback((user: SessionUser) => {
    setSession(current => current.status === 'authenticated' ? { ...current, user } : current);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    activeToken.current = null;
    clearActiveUser();
    setSession({ status: 'anonymous', token: null, user: null });
    router.replace('/');
  }, [clearActiveUser, router]);

  return <SessionContext.Provider value={{ session, authenticate, updateUser, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
}
