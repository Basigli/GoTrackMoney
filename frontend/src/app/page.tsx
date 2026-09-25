'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useData, Income, Expense } from '@/hooks/useData';
import Navbar from '@/components/Navbar';
import { HeaderDateInput } from '@/components/DateInputs';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useLanguage } from '@/i18n/LanguageContext';

import TransactionEditor, { type SavedTransaction } from '@/components/TransactionEditor';
import SafeDialog from '@/components/SafeDialog';
import MonthNavigation from '@/components/MonthNavigation';
import { useSelectedMonth } from '@/hooks/useSelectedMonth';
import type { Transaction, TransactionType } from '@/utils/transactions';
import { API_BASE } from '@/utils/api';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{id: number, username: string, session_duration_hours: number, is_admin: boolean} | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const { categories, fetchCategories, incomes, expenses, fetchIncomesByDate, fetchExpensesByDate } = useData(token);

  const [activeTab, setActiveTab] = useState<'uscite' | 'entrate'>('uscite');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtering state
  const [filterDate, setFilterDate] = useSelectedMonth(user?.id);
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
    let cancelled = false;
    Promise.resolve().then(async () => {
      const savedToken = localStorage.getItem('auth_token');
      if (!savedToken) { if (!cancelled) setLoading(false); return; }
      try {
        const response = await fetch(API_BASE + '/auth/me', { headers: { Authorization: 'Bearer ' + savedToken } });
        if (!response.ok) throw new Error();
        const current = await response.json();
        if (!cancelled) { setUser(current); setToken(savedToken); }
      } catch { if (!cancelled) localStorage.removeItem('auth_token'); }
      finally { if (!cancelled) setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (token) {
      fetchCategories();
    }
  }, [token, fetchCategories]);

  useEffect(() => {
    if (token) {
      const year = filterDate.getFullYear();
      const month = filterMode === 'month' ? filterDate.getMonth() + 1 : 0;
      let cancelled = false;
      Promise.all([fetchIncomesByDate(year, month), fetchExpensesByDate(year, month)])
        .then(() => { if (!cancelled) setDataReadyKey(periodKey); })
        .catch(() => { if (!cancelled) setDataErrorKey(periodKey); });
      return () => { cancelled = true; };
    }
  }, [token, filterDate, filterMode, fetchIncomesByDate, fetchExpensesByDate, dataRevision, periodKey]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      toast.error(t('auth.passwords_do_not_match'));
      return;
    }

    const endpoint = isLogin ? '/auth/login' : '/users';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
        toast.success(isLogin ? t('auth.login_success') : t('auth.register_success'));
      } else {
        const text = await res.text();
        if (res.status === 401) {
          toast.error(t('auth.invalid_credentials'));
        } else if (res.status === 409) {
          toast.error(t('auth.username_taken'));
        } else {
          toast.error(text || t('record.error_conn'));
        }
      }
    } catch (err) { 
      console.error(err);
      toast.error(t('record.error_conn'));
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

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
    void Promise.all([fetchIncomesByDate(year, month), fetchExpensesByDate(year, month)])
      .then(() => { setDataReadyKey(periodKey); setSelectedCategory(returnCategory); })
      .catch(() => { setDataErrorKey(periodKey); toast.error(t('analytics.load_error')); });
    const date = new Date(record.date);
    if (!record.deleted && returnCategory !== null && (record.category_id !== returnCategory || date.getUTCFullYear() !== year || (month !== 0 && date.getUTCMonth() + 1 !== month))) {
      toast(t('form.saved_elsewhere', { category: categories.find(c => c.id === record.category_id)?.name || '', date: format(date, 'd MMM yyyy', { locale: dateLocale }) }));
    }
  };

  if (loading) return null;

  if (token && user) {
    const dataReady = dataReadyKey === periodKey;
    const filteredIncomes = dataReady ? incomes : [];
    const filteredExpenses = dataReady ? expenses : [];

    const totalIncome = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncome - totalExpense;

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

    const getIconForCategory = (catId: number) => {
      const category = categories.find(c => c.id === catId);
      return category?.emoji || '📝';
    };

    const getCategoryColor = (catId: number) => {
      const category = categories.find(c => c.id === catId);
      if (category?.color) return category.color;
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16'];
      return colors[catId % colors.length];
    };



    return (
      <div className="app-container">

        <Navbar username={user.username} onLogout={logout} isAdmin={user.is_admin} />
        
        <div className="header-area">
          <DatePicker
            selected={filterDate}
            onChange={(date: Date | null) => date && setFilterDate(date)}
            dateFormat={filterMode === 'month' ? 'MMM yyyy' : 'yyyy'}
            showMonthYearPicker={filterMode === 'month'}
            showYearPicker={filterMode === 'year'}
            customInput={
              <HeaderDateInput 
                extraText={`${t('dashboard.filter_by')} ${filterMode === 'month' ? t('dashboard.filter_month').toLowerCase() : t('dashboard.filter_year').toLowerCase()}`} 
              />
            }
            locale={dateLocale}
            withPortal
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={() => setFilterMode(m => m === 'month' ? 'year' : 'month')}
              style={{ padding: '10px 16px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
            >
              {filterMode === 'month' ? t('dashboard.filter_year') : t('dashboard.filter_month')}
            </button>
            <button className="add-btn" aria-label={t("record.new")} onClick={() => openAddModal()}>+</button>
          </div>
        </div>

        <MonthNavigation date={filterDate} onChange={setFilterDate} mode={filterMode} />

        {!dataReady && (dataErrorKey === periodKey ? <p role="alert">{t('analytics.load_error')} <button className="secondary-btn" onClick={() => { setDataErrorKey(''); setDataRevision(n => n+1); }}>{t('analytics.retry')}</button></p> : <p role="status">{t('analytics.loading')}</p>)}
        {dataReady && <>
        <div className="balance-banner">
          <p className="balance-title">{t('dashboard.total_balance')}</p>
          <h1 className="balance-amount">{balance.toFixed(2)} €</h1>
          <div className="balance-stats">
            <div className="stat-item">
              <div className="stat-icon expense">↓</div>
              <div className="stat-details">
                <p>{t('dashboard.expenses')}</p>
                <h4>{totalExpense.toFixed(2)} €</h4>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon income">↑</div>
              <div className="stat-details">
                <p>{t('dashboard.incomes')}</p>
                <h4>{totalIncome.toFixed(2)} €</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="tabs">
          <div className={`tab ${activeTab === 'uscite' ? 'active' : ''}`} onClick={() => setActiveTab('uscite')}>{t('dashboard.expenses')}</div>
          <div className={`tab ${activeTab === 'entrate' ? 'active' : ''}`} onClick={() => setActiveTab('entrate')}>{t('dashboard.incomes')}</div>
        </div>

        <div className="list-container">
          {Object.entries(activeGroups).map(([catId, items]) => {
            const category = categories.find(c => c.id === parseInt(catId));
            const catTotal = items.reduce((sum: number, i: Income | Expense) => sum + i.amount, 0);
            const percentage = activeTotal > 0 ? (catTotal / activeTotal) * 100 : 0;
            const catName = category?.name || t('dashboard.unknown');
            
            return (
              <div key={catId} className="list-item" role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCategory(parseInt(catId)); } }} onClick={() => setSelectedCategory(parseInt(catId))}>
                <div className="item-icon">{getIconForCategory(parseInt(catId))}</div>
                <div className="item-content">
                  <div className="item-header">
                    <div className="item-title">{catName}</div>
                    <div className="item-amount">{catTotal.toFixed(2)} €</div>
                  </div>
                  <div className="item-progress-container">
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${percentage}%`, backgroundColor: getCategoryColor(parseInt(catId)) }}></div>
                    </div>
                    <div className="progress-text">{percentage.toFixed(2)} {t('dashboard.percentage_total')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        </>}
        {/* Add Income/Expense Modal */}
        {showAddModal && <TransactionEditor token={token} categories={categories} item={editingItem}
          initialType={initialEntry.type} initialCategory={initialEntry.category} initialDate={initialEntry.date}
          onClose={closeEditor} onSaved={saved} />}

        {/* Category Details Modal */}
        {selectedCategory !== null && (
          <SafeDialog title={t('dashboard.details_for', { category: categories.find(c => c.id === selectedCategory)?.name || '' })} onClose={() => setSelectedCategory(null)}>
            {activeTab === 'uscite' && <button className="submit-btn" onClick={() => openAddModal(selectedCategory)}>{t('form.add_expense')}</button>}
              <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
                {(activeGroups[selectedCategory] || []).map((item: Income | Expense) => (
                  <div key={item.id} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCategory(null); openEditModal(item); } }} className="list-item" style={{ padding: '12px 16px', cursor: 'pointer', marginBottom: '8px', borderRadius: '12px' }} onClick={() => {
                    setSelectedCategory(null);
                    openEditModal(item);
                  }}>
                    <div className="item-content">
                      <div className="item-header" style={{ marginBottom: '4px' }}>
                        <div className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'inherit' }}>{item.description || item.name}</span>
                          {('is_periodic' in item && item.is_periodic) && <span style={{ color: 'var(--primary-color)', fontSize: '12px', fontWeight: 'bold', padding: '2px 6px', background: 'var(--input-bg)', borderRadius: '8px' }}>{t('record.periodic') || 'Periodica'}</span>}
                        </div>
                        <div className="item-amount" style={{ color: activeTab === 'uscite' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                          {activeTab === 'uscite' ? '-' : '+'}{item.amount.toFixed(2)} €
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {format(new Date('spent_on' in item ? item.spent_on : item.received_on), 'd MMM yyyy, HH:mm', { locale: dateLocale })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          </SafeDialog>
        )}
      </div>
    );
  }

  // Login UI
  return (
    <div className="auth-wrapper">

      <div className="glass-container">
        <h1 className="form-title">{isLogin ? t('auth.login') : t('auth.register')}</h1>
        <p className="form-subtitle">
          {isLogin ? t('auth.login_subtitle') || 'Bentornato! Accedi per continuare.' : t('auth.register_subtitle') || 'Crea un account per iniziare!'}
        </p>
        <form onSubmit={handleAuth}>
          <input className="input-field" type="text" placeholder={t('auth.username')} value={username} onChange={e => setUsername(e.target.value)} required />
          <div style={{ position: 'relative' }}>
            <input className="input-field" type={showPassword ? "text" : "password"} placeholder={t('auth.password')} value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {!isLogin && (
            <div style={{ position: 'relative', marginTop: '12px' }}>
              <input className="input-field" type={showConfirmPassword ? "text" : "password"} placeholder={t('auth.confirm_password')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ margin: 0 }} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          )}
          <button type="submit" className="submit-btn">{isLogin ? t('auth.login') : t('auth.register')}</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={() => setIsLogin(!isLogin)} className="toggle-auth-btn">
            {isLogin ? t('auth.no_account') : t('auth.have_account')}
          </button>
        </div>
      </div>
    </div>
  );
}
