'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/i18n/LanguageContext';
import { format, subMonths } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend
} from 'recharts';

export default function AnalyticsPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, incomes, expenses, fetchCategories, fetchIncomes, fetchExpenses } = useData(token);
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchIncomes();
      fetchExpenses();
    }
  }, [token, fetchCategories, fetchIncomes, fetchExpenses]);

  if (loading || !user) return null;

  // Process data for Pie Chart (Expenses by Category for current month)
  const currentDate = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.spent_on);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  });

  const expensesByCategory = currentMonthExpenses.reduce((acc, exp) => {
    const cat = categories.find(c => c.id === exp.category_id);
    const name = cat ? `${cat.emoji} ${cat.name}` : t('dashboard.unknown');
    if (!acc[name]) acc[name] = 0;
    acc[name] += exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#14b8a6', '#f43f5e', '#84cc16'];

  // Process data for Bar Chart (Income vs Expense over last 6 months)
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return { month: d.getMonth(), year: d.getFullYear(), date: d };
  }).reverse();

  const barData = last6Months.map(m => {
    const inc = incomes.filter(i => {
      const d = new Date(i.received_on);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    }).reduce((sum, i) => sum + i.amount, 0);
    
    const exp = expenses.filter(e => {
      const d = new Date(e.spent_on);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    }).reduce((sum, e) => sum + e.amount, 0);

    return { 
      name: format(m.date, 'MMM', { locale: dateLocale }), 
      [t('dashboard.incomes')]: inc, 
      [t('dashboard.expenses')]: exp 
    };
  });

  return (
    <div className="app-container">
      <Navbar username={user.username} onLogout={logout} />
      
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>{t('analytics.title')}</h1>

        <div className="analytics-grid">
          {/* Expenses by Category (Pie Chart) */}
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-color)' }}>
              {t('analytics.expenses_by_category')} ({format(currentDate, 'MMMM yyyy', { locale: dateLocale })})
            </h3>
            {pieData.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip 
                      formatter={(value: any) => `${Number(value).toFixed(2)} €`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                {t('analytics.no_data')}
              </div>
            )}
          </div>

          {/* Income vs Expense (Bar Chart) */}
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-color)' }}>
              {t('analytics.income_vs_expense')}
            </h3>
            <div style={{ height: 300, minWidth: '500px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(value) => `${value}€`} />
                  <BarTooltip 
                    cursor={{ fill: 'var(--bg-color)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: any) => `${Number(value).toFixed(2)} €`}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey={t('dashboard.incomes')} fill="var(--success-color)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey={t('dashboard.expenses')} fill="var(--danger-color)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
