import { format, endOfMonth, startOfMonth } from 'date-fns';

export type TransactionType = 'expense' | 'income';
export interface Transaction {
  id: number; type: TransactionType; name: string; amount: number;
  description: string; category_id: number; date: string; is_periodic?: boolean;
}
export function transactionSearchLink(date: Date, type: TransactionType, category?: number) {
  const query = new URLSearchParams({
    type, from: format(startOfMonth(date), 'yyyy-MM-dd'), to: format(endOfMonth(date), 'yyyy-MM-dd'),
  });
  if (category !== undefined) query.set('category_id', String(category));
  return '/search?' + query;
}
