'use client';

import { useEffect, useState, forwardRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
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

export default function AnalyticsPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, fetchCategories, fetchIncomesByDate, fetchExpensesByDate } = useData(token);
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  
  const [rawPieData, setRawPieData] = useState<any[]>([]);
  const [rawBarData, setRawBarData] = useState<any>({ incomes: [], expenses: [] });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchCategories();
    }
  }, [token, fetchCategories]);

  useEffect(() => {
    if (token) {
      const month = filterDate.getMonth() + 1;
      const year = filterDate.getFullYear();
      
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/analytics/expenses-by-category?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setRawPieData(data || []));

      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/analytics/income-vs-expense?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setRawBarData(data || { incomes: [], expenses: [] }));
    }
  }, [token, filterDate]);

  if (loading || !user) return null;

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#14b8a6', '#f43f5e', '#84cc16'];
  const getStableColor = (id: number) => COLORS[id % COLORS.length];

  const pieData = rawPieData.map((d: any) => {
    const cat = categories.find(c => c.id === d.category_id);
    const name = cat ? `${cat.emoji} ${cat.name}` : t('dashboard.unknown');
    const color = cat?.color || getStableColor(d.category_id);
    return { name, value: d.total_amount, color };
  }).sort((a: any, b: any) => b.value - a.value);

  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(filterDate, i);
    return { month: d.getMonth() + 1, year: d.getFullYear(), date: d };
  }).reverse();

  const barData = last6Months.map(m => {
    const inc = rawBarData.incomes?.find((i: any) => i.year === m.year && i.month === m.month)?.total_amount || 0;
    const exp = rawBarData.expenses?.find((e: any) => e.year === m.year && e.month === m.month)?.total_amount || 0;
    return { 
      name: format(m.date, 'MMM', { locale: dateLocale }), 
      [t('dashboard.incomes')]: inc, 
      [t('dashboard.expenses')]: exp 
    };
  });

  const exportToCSV = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const year = filterDate.getFullYear();
      const month = filterDate.getMonth() + 1;
      
      const monthIncomes = await fetchIncomesByDate(year, month);
      const monthExpenses = await fetchExpensesByDate(year, month);

      const rows = [
        ['Tipo/Type', 'Data/Date', 'Categoria/Category', 'Importo/Amount', 'Descrizione/Description']
      ];

      const combined = [
        ...monthIncomes.map((i: any) => ({ type: t('record.income'), date: new Date(i.received_on), item: i })),
        ...monthExpenses.map((e: any) => ({ type: t('record.expense'), date: new Date(e.spent_on), item: e }))
      ].sort((a, b) => b.date.getTime() - a.date.getTime());

      for (const row of combined) {
        const cat = categories.find(c => c.id === row.item.category_id);
        const catName = cat ? cat.name : t('dashboard.unknown');
        rows.push([
          row.type,
          format(row.date, 'yyyy-MM-dd HH:mm'),
          `"${catName.replace(/"/g, '""')}"`,
          row.item.amount.toString(),
          `"${row.item.description.replace(/"/g, '""')}"`
        ]);
      }

      const csvContent = rows.map(e => e.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GoTrackMoney_Export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar username={user.username} onLogout={logout} isAdmin={user.is_admin} />
      
      <div style={{ padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{t('analytics.title')}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            
            <button onClick={exportToCSV} className="submit-btn" style={{ margin: 0, padding: '8px 16px', width: 'auto', fontSize: '14px', borderRadius: '12px' }}>
              {t('analytics.export_csv')}
            </button>
          </div>
        </div>

        <div className="analytics-grid">
          {/* Expenses by Category (Pie Chart) */}
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--text-color)' }}>
              {t('analytics.expenses_by_category')} ({format(filterDate, 'MMMM yyyy', { locale: dateLocale })})
            </h3>
            {pieData.length > 0 ? (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
