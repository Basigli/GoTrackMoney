'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/utils/api';
import type { Category } from '@/types/domain';

export function useCategories(token: string | null) {
  const requestId = useRef(0);
  const [snapshot, setSnapshot] = useState<{ token: string; categories: Category[] } | null>(null);
  const [failedToken, setFailedToken] = useState<string | null>(null);
  const fetchCategories = useCallback(async () => {
    if (!token) return [];
    const request = ++requestId.current;
    try {
      const categories = await apiRequest<Category[]>('/categories', { token });
      if (request === requestId.current) {
        setSnapshot({ token, categories: categories || [] });
        setFailedToken(null);
      }
      return categories;
    } catch (error) {
      if (request === requestId.current) setFailedToken(token);
      throw error;
    }
  }, [token]);
  return {
    categories: snapshot?.token === token ? snapshot.categories : [],
    ready: snapshot?.token === token,
    failed: failedToken === token,
    fetchCategories,
  };
}
