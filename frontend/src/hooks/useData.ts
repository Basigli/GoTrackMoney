import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8080';

export interface Category { id: number; name: string; emoji: string; type: string; }
export interface Income { id: number; name: string; amount: number; description: string; category_id: number; received_on: string; }
export interface Expense { id: number; name: string; amount: number; description: string; category_id: number; spent_on: string; }
export interface PeriodicExpense { id: number; name: string; amount: number; description: string; category_id: number; period_interval: number; period_unit: string; start_date: string; next_due_date: string; }

export function useData(token: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [periodicExpenses, setPeriodicExpenses] = useState<PeriodicExpense[]>([]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/categories`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setCategories(await res.json() || []);
  }, [token]);

  const fetchIncomes = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/incomes`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setIncomes(await res.json() || []);
  }, [token]);

  const fetchExpenses = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/expenses`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setExpenses(await res.json() || []);
  }, [token]);

  const fetchPeriodicExpenses = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/periodic-expenses`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setPeriodicExpenses(await res.json() || []);
  }, [token]);

  return { categories, incomes, expenses, periodicExpenses, fetchCategories, fetchIncomes, fetchExpenses, fetchPeriodicExpenses };
}
