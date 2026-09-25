'use client';
import { useCallback, useEffect, useState } from 'react';
import { format, startOfMonth } from 'date-fns';

function parseMonth(value: string | null) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0,4)) < 1000) return null;
  return new Date(Number(value.slice(0,4)), Number(value.slice(5)) - 1, 1);
}
export function useSelectedMonth(userId?: number) {
  const [date, setDate] = useState(() => startOfMonth(new Date()));
  useEffect(() => {
    if (!userId) return;
    const read = () => {
      const explicit = new URLSearchParams(window.location.search).get('month');
      let saved: string | null = null;
      try { saved = localStorage.getItem('selected-month:' + userId); } catch {}
      const parsed = parseMonth(explicit) || parseMonth(saved);
      if (parsed) { setDate(parsed); try { localStorage.setItem('selected-month:' + userId, format(parsed, 'yyyy-MM')); } catch {} }
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [userId]);
  const select = useCallback((value: Date) => {
    const normalized = startOfMonth(value);
    setDate(normalized);
    if (userId) { try { localStorage.setItem('selected-month:' + userId, format(normalized, 'yyyy-MM')); } catch {} }
    const url = new URL(window.location.href);
    url.searchParams.set('month', format(normalized, 'yyyy-MM'));
    window.history.replaceState(null, '', url);
  }, [userId]);
  return [date, select] as const;
}
