'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/utils/api';
import type { Category, PeriodicExpense } from '@/types/domain';

export interface UpcomingPayments {
  total_7: number;
  total_30: number;
  items: { schedule_id: number; name: string; due_date: string; amount: number }[];
}

export function useRecurringData(token: string | null) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; schedules: PeriodicExpense[]; categories: Category[]; upcoming: UpcomingPayments } | null>(null);
  const [failedKey, setFailedKey] = useState('');
  const key = `${token}:${revision}`;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    Promise.all([
      apiRequest<PeriodicExpense[]>('/periodic-expenses', { token, signal: controller.signal }),
      apiRequest<Category[]>('/categories', { token, signal: controller.signal }),
      apiRequest<UpcomingPayments>('/periodic-expenses/upcoming', { token, signal: controller.signal }),
    ]).then(([schedules, categories, upcoming]) => {
      if (!controller.signal.aborted) setSnapshot({ key, schedules: schedules || [], categories: categories || [], upcoming });
    }).catch(() => { if (!controller.signal.aborted) setFailedKey(key); });
    return () => controller.abort();
  }, [token, key]);

  return {
    data: snapshot?.key === key ? snapshot : null,
    failed: failedKey === key,
    refresh: () => setRevision(value => value + 1),
  };
}
