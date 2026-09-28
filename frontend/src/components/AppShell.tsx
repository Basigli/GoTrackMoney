'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/auth/SessionContext';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  if (session.status !== 'authenticated') return null;
  return <div className="app-container">
    <Navbar username={session.user.username} onLogout={logout} isAdmin={session.user.is_admin} />
    {children}
  </div>;
}
