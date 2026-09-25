import { useState, useCallback, useRef } from 'react';

import { API_BASE } from '@/utils/api';

export interface Category { id: number; name: string; emoji: string; type: string; color?: string; }
export interface Income { id: number; name: string; amount: number; description: string; category_id: number; received_on: string; }
export interface Expense { id: number; name: string; amount: number; description: string; category_id: number; spent_on: string; is_periodic?: boolean; }
export interface PeriodicExpense { paused: boolean; schedule_anchor: string; id: number; name: string; amount: number; description: string; category_id: number; period_interval: number; period_unit: string; start_date: string; next_due_date: string; }

export function useData(token: string | null) {
  const incomeRequest = useRef(0);
  const expenseRequest = useRef(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [periodicExpenses, setPeriodicExpenses] = useState<PeriodicExpense[]>([]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/categories`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCategories(await res.json() || []);
  }, [token]);

  const fetchIncomes = useCallback(async (offset = 0) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/incomes?limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json() || [];
      if (offset === 0) setIncomes(data);
      else setIncomes(prev => [...prev, ...data]);
      return data;
    }
    return [];
  }, [token]);

  const fetchExpenses = useCallback(async (offset = 0) => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/expenses?limit=100&offset=${offset}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json() || [];
      if (offset === 0) setExpenses(data);
      else setExpenses(prev => [...prev, ...data]);
      return data;
    }
    return [];
  }, [token]);

  const fetchPeriodicExpenses = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/periodic-expenses`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setPeriodicExpenses(await res.json() || []);
  }, [token]);

  const fetchIncomesByDate = useCallback(async (year: number, month: number) => {
    if (!token) return;
    const request = ++incomeRequest.current;
    const res = await fetch(`${API_BASE}/incomes/filter?year=${year}&month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json() || [];
      if (request === incomeRequest.current) setIncomes(data);
      return data;
    }
    throw new Error("Unable to load transactions");
  }, [token]);

  const fetchExpensesByDate = useCallback(async (year: number, month: number) => {
    if (!token) return;
    const request = ++expenseRequest.current;
    const res = await fetch(`${API_BASE}/expenses/filter?year=${year}&month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json() || [];
      if (request === expenseRequest.current) setExpenses(data);
      return data;
    }
    throw new Error("Unable to load transactions");
  }, [token]);

  return { categories, incomes, expenses, periodicExpenses, fetchCategories, fetchIncomes, fetchExpenses, fetchPeriodicExpenses, fetchIncomesByDate, fetchExpensesByDate };
}
