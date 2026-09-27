'use client';

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const activeUserKey = 'app_theme_active_user';
const themeChangeEvent = 'app-theme-change';
const userThemeKey = (userId: number) => `app_theme:${userId}`;

function readActiveUser(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!localStorage.getItem('auth_token')) return null;
    const id = Number(localStorage.getItem(activeUserKey));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}

function readTheme(userId: number | null): Theme {
  if (userId === null || typeof window === 'undefined') return 'light';
  try { return localStorage.getItem(userThemeKey(userId)) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function getThemeSnapshot(): Theme { return readTheme(readActiveUser()); }
function getServerThemeSnapshot(): Theme { return 'light'; }
function subscribeToTheme(listener: () => void) {
  const onStorage = () => {
    applyTheme(getThemeSnapshot());
    listener();
  };
  window.addEventListener(themeChangeEvent, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(themeChangeEvent, listener);
    window.removeEventListener('storage', onStorage);
  };
}

function notifyThemeChanged() { window.dispatchEvent(new Event(themeChangeEvent)); }

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setActiveUser: (userId: number) => void;
  clearActiveUser: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  const setActiveUser = useCallback((userId: number) => {
    try { localStorage.setItem(activeUserKey, String(userId)); } catch {}
    const selected = readTheme(userId);
    applyTheme(selected);
    notifyThemeChanged();
  }, []);

  const clearActiveUser = useCallback(() => {
    try { localStorage.removeItem(activeUserKey); } catch {}
    applyTheme('light');
    notifyThemeChanged();
  }, []);

  const setTheme = useCallback((selected: Theme) => {
    const userId = readActiveUser();
    if (userId === null) return;
    try { localStorage.setItem(userThemeKey(userId), selected); } catch {}
    applyTheme(selected);
    notifyThemeChanged();
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, setActiveUser, clearActiveUser }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
