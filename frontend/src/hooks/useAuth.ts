'use client';

import { useSession } from '@/auth/SessionContext';

export function useAuth() {
  const { session, logout } = useSession();
  return {
    token: session.token,
    user: session.user,
    loading: session.status === 'loading',
    logout,
  };
}
