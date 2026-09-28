'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const languageChangeEvent = 'app-language-change';

function getLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('app_language');
    if (saved === 'it' || saved === 'en') return saved;
  } catch {}
  return navigator.language.split('-')[0] === 'it' ? 'it' : 'en';
}
function getServerLanguage(): Language { return 'en'; }

function subscribe(listener: () => void) {
  window.addEventListener(languageChangeEvent, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(languageChangeEvent, listener);
    window.removeEventListener('storage', listener);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getLanguage, getServerLanguage);

  const changeLanguage = (lang: Language) => {
    localStorage.setItem('app_language', lang);
    window.dispatchEvent(new Event(languageChangeEvent));
  };

  const t = (key: string, params?: Record<string, string>): string => {
    const dict = translations[language] as Record<string, string>;
    let text = dict[key] || key;
    
    if (params) {
      Object.keys(params).forEach(k => {
        text = text.replace(`{${k}}`, params[k]);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
