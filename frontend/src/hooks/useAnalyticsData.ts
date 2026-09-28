'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/utils/api';
import type { Category } from '@/types/domain';

export interface CategoryTotal { category_id: number; total_amount: number }
export interface MonthlyTotal { year: number; month: number; total_amount: number }
export interface MonthlyTotals { incomes: MonthlyTotal[]; expenses: MonthlyTotal[] }

export function useAnalyticsData(token: string | null, monthKey: string) {
  const [snapshot, setSnapshot] = useState<{ key: string; categories: Category[]; categoryTotals: CategoryTotal[]; monthlyTotals: MonthlyTotals } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${token}:${monthKey}:${revision}`;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const [year, month] = monthKey.split('-');
    const query = `?year=${year}&month=${month}`;
    Promise.all([
      apiRequest<Category[]>('/categories', { token, signal: controller.signal }),
      apiRequest<CategoryTotal[]>(`/analytics/expenses-by-category${query}`, { token, signal: controller.signal }),
      apiRequest<MonthlyTotals>(`/analytics/income-vs-expense${query}`, { token, signal: controller.signal }),
    ]).then(([categories, categoryTotals, monthlyTotals]) => {
      if (controller.signal.aborted) return;
      setSnapshot({
        key, categories: categories || [], categoryTotals: categoryTotals || [],
        monthlyTotals: { incomes: monthlyTotals.incomes || [], expenses: monthlyTotals.expenses || [] },
      });
    }).catch(() => { if (!controller.signal.aborted) setFailedKey(key); });
    return () => controller.abort();
  }, [token, monthKey, key]);

  const ready = snapshot?.key === key;
  return {
    categories: ready ? snapshot.categories : [],
    categoryTotals: ready ? snapshot.categoryTotals : [],
    monthlyTotals: ready ? snapshot.monthlyTotals : { incomes: [], expenses: [] },
    ready,
    failed: failedKey === key,
    retry: () => setRevision(value => value + 1),
  };
}
