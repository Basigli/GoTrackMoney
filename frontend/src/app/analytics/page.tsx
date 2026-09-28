'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MonthNavigation from '@/components/MonthNavigation';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { transactionSearchLink } from '@/utils/transactions';
import { useAuth } from '@/hooks/useAuth';
import type { Income, Expense } from '@/types/domain';
import { apiRequest } from '@/utils/api';
import { categoryColor } from '@/utils/categoryColors';
import toast from 'react-hot-toast';
import AppShell from '@/components/AppShell';
import styles from './Analytics.module.css';
import { useLanguage } from '@/i18n/LanguageContext';
import { format, subMonths } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, Legend
} from 'recharts';

// Quote all fields and prevent text from being interpreted as spreadsheet formulas.
function csvCell(value: string | number): string {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function AnalyticsPage() {
  const { token, user, loading } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;
  const [filterDate, setFilterDate] = useSelectedMonth(user?.id);
  const router = useRouter();

  const [isExporting, setIsExporting] = useState(false);
  const monthKey = format(filterDate, 'yyyy-MM');
  const { categories, categoryTotals: rawPieData, monthlyTotals: rawBarData, ready: isReady, failed: hasError, retry } = useAnalyticsData(token, monthKey);
  const money = (value: number) => new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-IE', {
    style: 'currency', currency: 'EUR',
  }).format(value);

  if (loading || !user) return null;

  const pieData = rawPieData.map((d) => {
    const cat = categories.find(c => c.id === d.category_id);
    const name = cat ? `${cat.emoji} ${cat.name}` : t('dashboard.unknown');
    const color = categoryColor({ id: d.category_id, color: cat?.color });
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
        apiRequest<Income[]>(`/incomes/filter${query}`, { token }),
        apiRequest<Expense[]>(`/expenses/filter${query}`, { token }),
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
    <AppShell>

      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('analytics.title')}</h1>
          <button disabled={isExporting || !isReady} onClick={exportToCSV} className={`submit-btn ${styles.exportButton}`}>
            {t(isExporting ? 'analytics.exporting' : 'analytics.export_csv')}
          </button>
        </div>
        <MonthNavigation date={filterDate} onChange={setFilterDate} />

        {!isReady && (
          <div role={hasError ? 'alert' : 'status'} className="analytics-card">
            {t(hasError ? 'analytics.load_error' : 'analytics.loading')}
            {hasError && <button className="submit-btn" onClick={retry}>{t('analytics.retry')}</button>}
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
        <div className={styles.grid}>
          {/* Expenses by Category (Pie Chart) */}
          <div className={styles.chartPanel}>
            <h3 className={styles.chartTitle}>
              {t('analytics.expenses_by_category')} ({format(filterDate, 'MMMM yyyy', { locale: dateLocale })})
            </h3>
            {pieData.length > 0 ? (
              <div className={styles.chartArea}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 300 }}>
                  <PieChart>
                    <Pie onClick={(_, index) => router.push(transactionSearchLink(filterDate, "expense", pieData[index].id))} style={{ cursor: "pointer" }} data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <PieTooltip
                      formatter={value => money(Number(value))}
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--surface-elevated)', color: 'var(--text-color)' }}
                      itemStyle={{ color: 'var(--text-color)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={styles.emptyChart}>
                {t('analytics.no_data')}
              </div>
            )}
            {pieData.length > 0 && (
              <table className={styles.table}>
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
          <div className={`${styles.chartPanel} ${styles.chartPanelScrollable}`}>
            <h3 className={styles.chartTitle}>
              {t('analytics.income_vs_expense')}
            </h3>
            <div className={styles.chartArea}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 300 }}>
                <BarChart data={barData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(value) => `${value}€`} />
                  <BarTooltip
                    cursor={{ fill: 'var(--bg-color)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--surface-elevated)', color: 'var(--text-color)' }}
                    itemStyle={{ color: 'var(--text-color)' }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    formatter={value => money(Number(value))}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', color: 'var(--text-muted)' }} />
                  <Bar onClick={(_, index) => router.push(transactionSearchLink(barData[index].date, "income"))} style={{ cursor: "pointer" }} dataKey="income" name={t('dashboard.incomes')} fill="var(--success-color)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar onClick={(_, index) => router.push(transactionSearchLink(barData[index].date, "expense"))} style={{ cursor: "pointer" }} dataKey="expense" name={t('dashboard.expenses')} fill="var(--danger-color)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.chartLinks}>{barData.map(month => <div key={month.name}>
              <strong>{month.name}</strong>{' · '}
              <Link href={transactionSearchLink(month.date, 'income')}>{t('dashboard.incomes')}</Link>{' · '}
              <Link href={transactionSearchLink(month.date, 'expense')}>{t('dashboard.expenses')}</Link>
            </div>)}</div>
          </div>
        </div>
        </>}
      </div>
    </AppShell>
  );
}
