'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MonthNavigation from '@/components/MonthNavigation';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import { transactionSearchLink } from '@/utils/transactions';
import { useAuth } from '@/hooks/useAuth';
import type { Category, Income, Expense } from '@/hooks/useData';
import { API_BASE } from '@/utils/api';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import { HeaderDateInput } from '@/components/DateInputs';
import { useLanguage } from '@/i18n/LanguageContext';
import { format, subMonths } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend
} from 'recharts';

interface CategoryTotal { category_id: number; total_amount: number }
interface MonthlyTotal { year: number; month: number; total_amount: number }
interface MonthlyTotals { incomes: MonthlyTotal[]; expenses: MonthlyTotal[] }

async function fetchJSON<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

// Quote all fields and prevent text from being interpreted as spreadsheet formulas.
function csvCell(value: string | number): string {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function AnalyticsPage() {
  const { token, user, loading, logout } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;
  const [filterDate, setFilterDate] = useSelectedMonth(user?.id);
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<{
    key: string; categories: CategoryTotal[]; totals: MonthlyTotals;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const monthKey = format(filterDate, 'yyyy-MM');
  const requestKey = `${token}:${monthKey}:${retry}`;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const [year, month] = monthKey.split('-');
    const query = `?year=${year}&month=${month}`;
    Promise.all([
      fetchJSON<Category[]>('/categories', token, controller.signal),
      fetchJSON<CategoryTotal[]>(`/analytics/expenses-by-category${query}`, token, controller.signal),
      fetchJSON<MonthlyTotals>(`/analytics/income-vs-expense${query}`, token, controller.signal),
    ]).then(([categoryList, pie, totals]) => {
      if (controller.signal.aborted) return;
      setCategories(categoryList || []);
      setSnapshot({ key: requestKey, categories: pie || [], totals: {
        incomes: totals.incomes || [], expenses: totals.expenses || [],
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setFailedKey(requestKey);
    });
    return () => controller.abort();
  }, [token, monthKey, requestKey]);

  const hasError = failedKey === requestKey;
  const isReady = snapshot?.key === requestKey;
  const rawPieData = isReady ? snapshot.categories : [];
  const rawBarData = isReady ? snapshot.totals : { incomes: [], expenses: [] };
  const money = (value: number) => new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-IE', {
    style: 'currency', currency: 'EUR',
  }).format(value);

  if (loading || !user) return null;

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#14b8a6', '#f43f5e', '#84cc16'];
  const getStableColor = (id: number) => COLORS[id % COLORS.length];

  const pieData = rawPieData.map((d) => {
    const cat = categories.find(c => c.id === d.category_id);
    const name = cat ? `${cat.emoji} ${cat.name}` : t('dashboard.unknown');
    const color = cat?.color || getStableColor(d.category_id);
    return { id: d.category_id, name, value: d.total_amount, color };
  }).sort((a, b) => b.value - a.value);

  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(filterDate, i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), date: d };
  }).reverse();

  const barData = last6Months.map(m => {
    const inc = rawBarData.incomes?.find((i) => i.year === m.year && i.month === m.month)?.total_amount || 0;
    const exp = rawBarData.expenses?.find((e) => e.year === m.year && e.month === m.month)?.total_amount || 0;
    return {
      name: format(m.date, 'MMM yy', { locale: dateLocale }),
      date: m.date,
      income: inc,
      expense: exp
    };
  });

  const exportToCSV = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const year = filterDate.getFullYear();
      const month = filterDate.getMonth() + 1;

      const query = `?year=${year}&month=${month}`;
      const [monthIncomes, monthExpenses] = await Promise.all([
        fetchJSON<Income[]>(`/incomes/filter${query}`, token),
        fetchJSON<Expense[]>(`/expenses/filter${query}`, token),
      ]);
      const rows: (string | number)[][] = [
        [t('record.type'), t('record.date'), t('record.category'), t('record.amount'), t('record.description')],
      ];
      const combined = [
        ...(monthIncomes || []).map(i => ({ type: t('record.income'), date: i.received_on, item: i })),
        ...(monthExpenses || []).map(e => ({ type: t('record.expense'), date: e.spent_on, item: e })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      for (const row of combined) {
        rows.push([
          row.type, row.date,
          categories.find(c => c.id === row.item.category_id)?.name || t('dashboard.unknown'),
          row.item.amount, row.item.description || '',
        ]);
      }
      const csvContent = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GoTrackMoney_Export_${format(filterDate, 'yyyy-MM')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t('analytics.export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  const selected = barData[barData.length - 1];
  const balance = selected.income - selected.expense;
  const savingsRate = selected.income > 0 ? balance / selected.income : null;
  const expenseTotal = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="app-container">
      <Navbar username={user.username} onLogout={logout} isAdmin={user.is_admin} />

      <div style={{ padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{t('analytics.title')}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <DatePicker
              selected={filterDate}
              onChange={(date: Date | null) => date && setFilterDate(date)}
              dateFormat="MMM yyyy"
              showMonthYearPicker
              customInput={
                <HeaderDateInput
                  extraText={`${t('dashboard.filter_by')} ${t('dashboard.filter_month').toLowerCase()}`}
                />
              }
              locale={dateLocale}
              withPortal
            />

            <MonthNavigation date={filterDate} onChange={setFilterDate} />
            <button disabled={isExporting || !isReady} onClick={exportToCSV} className="submit-btn" style={{ margin: 0, padding: '8px 16px', width: 'auto', fontSize: '14px', borderRadius: '12px' }}>
              {t(isExporting ? 'analytics.exporting' : 'analytics.export_csv')}
            </button>
          </div>
        </div>

        {!isReady && (
          <div role={hasError ? 'alert' : 'status'} className="analytics-card">
            {t(hasError ? 'analytics.load_error' : 'analytics.loading')}
            {hasError && <button className="submit-btn" onClick={() => setRetry(value => value + 1)}>{t('analytics.retry')}</button>}
          </div>
        )}
        {isReady && <>
        <div className="analytics-summary">
          {[
            [t('dashboard.incomes'), money(selected.income)],
            [t('dashboard.expenses'), money(selected.expense)],
            [t('analytics.net_balance'), money(balance)],
            [t('analytics.savings_rate'), savingsRate === null ? '—' : new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 }).format(savingsRate)],
          ].map(([label, value]) => (
            <div className="analytics-card" key={label}><div>{label}</div><strong>{value}</strong></div>
          ))}
        </div>
        <p className="analytics-note">{format(filterDate, 'MMMM yyyy', { locale: dateLocale })} · {t('analytics.rate_note')}</p>
        <div className="analytics-grid">
          {/* Expenses by Category (Pie Chart) */}
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-color)' }}>
              {t('analytics.expenses_by_category')} ({format(filterDate, 'MMMM yyyy', { locale: dateLocale })})
            </h3>
            {pieData.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 300 }}>
                  <PieChart>
                    <Pie onClick={(_, index) => router.push(transactionSearchLink(filterDate, "expense", pieData[index].id))} style={{ cursor: "pointer" }} data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <PieTooltip
                      formatter={value => money(Number(value))}
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
            {pieData.length > 0 && (
              <table className="analytics-table">
                <caption>{t('analytics.breakdown')}</caption>
                <thead><tr><th>{t('record.category')}</th><th>{t('record.amount')}</th><th>%</th></tr></thead>
                <tbody>{pieData.map(item => (
                  <tr key={item.id}>
                    <th scope="row"><span aria-hidden="true" style={{ color: item.color }}>● </span><Link href={transactionSearchLink(filterDate, "expense", item.id)}>{item.name}</Link></th>
                    <td>{money(item.value)}</td>
                    <td>{expenseTotal > 0 ? new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 }).format(item.value / expenseTotal) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          {/* Income vs Expense (Bar Chart) */}
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-color)' }}>
              {t('analytics.income_vs_expense')}
            </h3>
            <div style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 300 }}>
                <BarChart data={barData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(value) => `${value}€`} />
                  <BarTooltip
                    cursor={{ fill: 'var(--bg-color)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={value => money(Number(value))}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar onClick={(_, index) => router.push(transactionSearchLink(barData[index].date, "income"))} style={{ cursor: "pointer" }} dataKey="income" name={t('dashboard.incomes')} fill="var(--success-color)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar onClick={(_, index) => router.push(transactionSearchLink(barData[index].date, "expense"))} style={{ cursor: "pointer" }} dataKey="expense" name={t('dashboard.expenses')} fill="var(--danger-color)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-links">{barData.map(month => <div key={month.name}>
              <strong>{month.name}</strong>{' · '}
              <Link href={transactionSearchLink(month.date, 'income')}>{t('dashboard.incomes')}</Link>{' · '}
              <Link href={transactionSearchLink(month.date, 'expense')}>{t('dashboard.expenses')}</Link>
            </div>)}</div>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
}
