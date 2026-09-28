'use client';

import { useState, useEffect } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { usePeriodTransactions } from '@/hooks/usePeriodTransactions';
import type { Income, Expense, SessionUser } from '@/types/domain';
import AppShell from '@/components/AppShell';
import AuthScreen from '@/components/AuthScreen';
import DashboardBalance from './DashboardBalance';
import DashboardCategories from './DashboardCategories';
import DashboardCategoryDetails from './DashboardCategoryDetails';
import styles from './Dashboard.module.css';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSession } from '@/auth/SessionContext';

import TransactionEditor, { type SavedTransaction } from '@/components/TransactionEditor';
import MonthNavigation from '@/components/MonthNavigation';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import type { Transaction, TransactionType } from '@/utils/transactions';

export default function Home() {
  const { session } = useSession();
  if (session.status === 'loading') return null;
  if (session.status === 'anonymous') return <AuthScreen />;
  return <Dashboard key={session.user.id} token={session.token} user={session.user} />;
}

function Dashboard({ token, user }: { token: string; user: SessionUser }) {
  const { categories, ready: categoriesReady, failed: categoriesFailed, fetchCategories } = useCategories(token);
  const { incomes, expenses, fetchPeriod } = usePeriodTransactions(token);

  const [activeTab, setActiveTab] = useState<'uscite' | 'entrate'>('uscite');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtering state
  const [filterDate, setFilterDate] = useSelectedMonth(user.id);
  const [filterMode, setFilterMode] = useState<'month' | 'year'>('month');

  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;

  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  const [initialEntry, setInitialEntry] = useState<{ type: TransactionType; category?: number; date: Date }>({ type: 'expense', date: new Date() });
  const [dataErrorKey, setDataErrorKey] = useState('');
  const [dataReadyKey, setDataReadyKey] = useState('');
  const periodKey = `${token}:${filterMode}:${filterDate.getFullYear()}:${filterMode === 'month' ? filterDate.getMonth() + 1 : 0}`;
  const [dataRevision, setDataRevision] = useState(0);
  const [returnCategory, setReturnCategory] = useState<number | null>(null);

  // Category details modal state
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      void fetchCategories().catch(() => {});
    }
  }, [token, fetchCategories]);

  useEffect(() => {
    if (token) {
      const year = filterDate.getFullYear();
      const month = filterMode === 'month' ? filterDate.getMonth() + 1 : 0;
      let cancelled = false;
      fetchPeriod(year, month)
        .then(() => { if (!cancelled) setDataReadyKey(periodKey); })
        .catch(() => { if (!cancelled) setDataErrorKey(periodKey); });
      return () => { cancelled = true; };
    }
  }, [token, filterDate, filterMode, fetchPeriod, dataRevision, periodKey]);

  const openAddModal = (category?: number) => {
    setEditingItem(null);
    setReturnCategory(category ?? null);
    let date = new Date();
    if (category !== undefined) {
      const sameYear = filterDate.getFullYear() === date.getFullYear();
      const sameMonth = sameYear && filterDate.getMonth() === date.getMonth();
      if (filterMode === 'month' && !sameMonth) date = new Date(filterDate.getFullYear(), filterDate.getMonth(), 1, 12);
      if (filterMode === 'year' && !sameYear) date = new Date(filterDate.getFullYear(), 0, 1, 12);
    }
    setInitialEntry({ type: category !== undefined || activeTab === 'uscite' ? 'expense' : 'income', category, date });
    setSelectedCategory(null);
    setShowAddModal(true);
  };
  const openEditModal = (item: Income | Expense) => {
    setEditingItem({ ...item, type: 'spent_on' in item ? 'expense' : 'income', date: 'spent_on' in item ? item.spent_on : item.received_on });
    setReturnCategory(item.category_id);
    setShowAddModal(true);
  };
  const closeEditor = () => { setShowAddModal(false); setSelectedCategory(returnCategory); };
  const saved = (record: SavedTransaction) => {
    setShowAddModal(false);
    setSelectedCategory(null);
    setDataReadyKey('');
    const year = filterDate.getFullYear();
    const month = filterMode === 'month' ? filterDate.getMonth() + 1 : 0;
    void fetchPeriod(year, month)
      .then(() => { setDataReadyKey(periodKey); setSelectedCategory(returnCategory); })
      .catch(() => { setDataErrorKey(periodKey); toast.error(t('analytics.load_error')); });
    const date = new Date(record.date);
    if (!record.deleted && returnCategory !== null && (record.category_id !== returnCategory || date.getUTCFullYear() !== year || (month !== 0 && date.getUTCMonth() + 1 !== month))) {
      toast(t('form.saved_elsewhere', { category: categories.find(c => c.id === record.category_id)?.name || '', date: format(date, 'd MMM yyyy', { locale: dateLocale }) }));
    }
  };

  const dataReady = dataReadyKey === periodKey && categoriesReady;
  const filteredIncomes = dataReady ? incomes : [];
  const filteredExpenses = dataReady ? expenses : [];

  const totalIncome = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const groupedExpenses = filteredExpenses.reduce((acc, exp) => {
    if (!acc[exp.category_id]) acc[exp.category_id] = [];
    acc[exp.category_id].push(exp);
    return acc;
  }, {} as Record<number, Expense[]>);

  const groupedIncomes = filteredIncomes.reduce((acc, inc) => {
    if (!acc[inc.category_id]) acc[inc.category_id] = [];
    acc[inc.category_id].push(inc);
    return acc;
  }, {} as Record<number, Income[]>);

  const activeGroups = activeTab === 'uscite' ? groupedExpenses : groupedIncomes;
  const activeTotal = activeTab === 'uscite' ? totalExpense : totalIncome;

  return (
    <AppShell>
      <div className={styles.actions}>
        <div className={styles.actionButtons}>
          <button
            type="button"
            className={`secondary-btn ${styles.modeToggle}`}
            onClick={() => setFilterMode(m => m === 'month' ? 'year' : 'month')}
          >
            {filterMode === 'month' ? t('dashboard.filter_year') : t('dashboard.filter_month')}
          </button>
          <button className={styles.addButton} aria-label={t('record.new')} onClick={() => openAddModal()}>+</button>
        </div>
      </div>

      <MonthNavigation date={filterDate} onChange={setFilterDate} mode={filterMode} />

      {!dataReady && (dataErrorKey === periodKey || categoriesFailed ? <p role="alert">{t('analytics.load_error')} <button className="secondary-btn" onClick={() => { setDataErrorKey(''); setDataRevision(n => n + 1); void fetchCategories().catch(() => {}); }}>{t('analytics.retry')}</button></p> : <p role="status">{t('analytics.loading')}</p>)}
      {dataReady && <>
        <DashboardBalance income={totalIncome} expense={totalExpense} />
        <DashboardCategories tab={activeTab} onTabChange={setActiveTab} groups={activeGroups} categories={categories} total={activeTotal} onSelect={setSelectedCategory} />
      </>}
      {showAddModal && <TransactionEditor token={token} categories={categories} item={editingItem}
        initialType={initialEntry.type} initialCategory={initialEntry.category} initialDate={initialEntry.date}
        onClose={closeEditor} onSaved={saved} />}

      {selectedCategory !== null && <DashboardCategoryDetails
        categoryId={selectedCategory} categories={categories} tab={activeTab}
        items={activeGroups[selectedCategory] || []} locale={dateLocale}
        onClose={() => setSelectedCategory(null)} onAddExpense={openAddModal}
        onEdit={item => { setSelectedCategory(null); openEditModal(item); }}
      />}
    </AppShell>
  );
}
