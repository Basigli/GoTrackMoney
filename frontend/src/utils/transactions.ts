import { format, endOfMonth, startOfMonth } from 'date-fns';

export type TransactionType = 'expense' | 'income';
export interface Transaction {
  id: number; type: TransactionType; name: string; amount: number;
  description: string; category_id: number; date: string; is_periodic?: boolean;
}

// Ledger period filters use UTC calendar boundaries; month 0 means a whole year.
export interface TransactionViewPeriod { year: number; month: number }

export function transactionPeriodNotice(date: Date, period: TransactionViewPeriod | undefined, language: string) {
  if (!period || !Number.isFinite(date.getTime()) ||
    (date.getUTCFullYear() === period.year && (period.month === 0 || date.getUTCMonth() + 1 === period.month))) return null;
  const formatter = new Intl.DateTimeFormat(language, {
    year: 'numeric', ...(period.month === 0 ? {} : { month: 'long' }), timeZone: 'UTC',
  });
  return {
    period: formatter.format(new Date(Date.UTC(period.year, Math.max(0, period.month - 1), 1))),
    destination: formatter.format(date),
  };
}

export function transactionSearchLink(date: Date, type: TransactionType, category?: number) {
  const query = new URLSearchParams({
    type, from: format(startOfMonth(date), 'yyyy-MM-dd'), to: format(endOfMonth(date), 'yyyy-MM-dd'),
  });
  if (category !== undefined) query.set('category_id', String(category));
  return '/search?' + query;
}
