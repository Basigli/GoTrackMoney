'use client';

import { LanguageProvider } from '@/i18n/LanguageContext';
import React from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      {children}
    </LanguageProvider>
  );
}
