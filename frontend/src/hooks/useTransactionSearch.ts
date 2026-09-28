'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/utils/api';
import type { Category } from '@/types/domain';
import type { Transaction } from '@/utils/transactions';

export interface SearchResults { items: Transaction[]; total: number; limit: number; offset: number }

export function useTransactionSearch(token: string | null, query: string) {
  const [snapshot, setSnapshot] = useState<{ key: string; token: string; result: SearchResults; categories: Category[] } | null>(null);
  const [failedKey, setFailedKey] = useState('');
  const [revision, setRevision] = useState(0);
  const key = `${token}:${query}:${revision}`;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      Promise.all([
        apiRequest<SearchResults>('/transactions/search?' + query, { token, signal: controller.signal }),
        apiRequest<Category[]>('/categories', { token, signal: controller.signal }),
      ]).then(([result, categories]) => {
        if (!controller.signal.aborted) setSnapshot({ key, token, result, categories: categories || [] });
      }).catch(() => { if (!controller.signal.aborted) setFailedKey(key); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [token, query, key]);

  const ready = snapshot?.key === key;
  return {
    result: ready ? snapshot.result : null,
    categories: snapshot?.token === token ? snapshot.categories : [],
    ready,
    failed: failedKey === key,
    retry: () => setRevision(value => value + 1),
  };
}
