'use client';

import { LanguageProvider } from '@/i18n/LanguageContext';
import { Toaster } from 'react-hot-toast';
import React from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <Toaster position="bottom-center" />
      {children}
    </LanguageProvider>
  );
}
