'use client';

import { LanguageProvider } from '@/i18n/LanguageContext';
import { ThemeProvider } from '@/i18n/ThemeContext';
import { SessionProvider } from '@/auth/SessionContext';
import { Toaster } from 'react-hot-toast';
import React from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SessionProvider>
          <Toaster position="bottom-center" toastOptions={{ style: { background: 'var(--surface-elevated)', color: 'var(--text-color)', border: '1px solid var(--border-color)' } }} />
          {children}
        </SessionProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
