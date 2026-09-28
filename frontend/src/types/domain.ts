export interface SessionUser {
  id: number;
  username: string;
  session_duration_hours: number;
  is_admin: boolean;
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
  type: 'expense' | 'income';
  color?: string;
}

export interface Income {
  id: number;
  name: string;
  amount: number;
  description: string;
  category_id: number;
  received_on: string;
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  description: string;
  category_id: number;
  spent_on: string;
  is_periodic?: boolean;
}

export interface PeriodicExpense {
  paused: boolean;
  schedule_anchor: string;
  id: number;
  name: string;
  amount: number;
  description: string;
  category_id: number;
  period_interval: number;
  period_unit: string;
  start_date: string;
  next_due_date: string;
}
