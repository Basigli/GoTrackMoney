import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8080';

export interface Category { id: number; name: string; }
export interface Income { id: number; name: string; amount: number; description: string; category_id: number; received_on: string; }
export interface Expense { id: number; name: string; amount: number; description: string; category_id: number; spent_on: string; }

export function useData(token: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

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

  return { categories, incomes, expenses, fetchCategories, fetchIncomes, fetchExpenses };
}
