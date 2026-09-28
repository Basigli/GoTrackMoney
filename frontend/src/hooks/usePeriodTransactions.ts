'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/utils/api';
import type { Income, Expense } from '@/types/domain';

export function usePeriodTransactions(token: string | null) {
  const requestId = useRef(0);
  const [snapshot, setSnapshot] = useState<{ token: string; incomes: Income[]; expenses: Expense[] } | null>(null);
  const fetchPeriod = useCallback(async (year: number, month: number) => {
    if (!token) return;
    const current = ++requestId.current;
    const query = `?year=${year}&month=${month}`;
    const [incomes, expenses] = await Promise.all([
      apiRequest<Income[]>(`/incomes/filter${query}`, { token }),
      apiRequest<Expense[]>(`/expenses/filter${query}`, { token }),
    ]);
    if (current === requestId.current) setSnapshot({ token, incomes: incomes || [], expenses: expenses || [] });
  }, [token]);
  return {
    incomes: snapshot?.token === token ? snapshot.incomes : [],
    expenses: snapshot?.token === token ? snapshot.expenses : [],
    fetchPeriod,
  };
}
