'use client';

import { useState, useEffect, FormEvent, forwardRef } from 'react';
import { useData, Income, Expense } from '@/hooks/useData';
import Navbar from '@/components/Navbar';
import { HeaderDateInput, ModalDateInput } from '@/components/DateInputs';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';
import { useLanguage } from '@/i18n/LanguageContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8098';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{id: number, username: string, session_duration_hours: number} | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const { categories, fetchCategories, incomes, fetchIncomes, expenses, fetchExpenses } = useData(token);

  const [activeTab, setActiveTab] = useState<'uscite' | 'entrate'>('uscite');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtering state
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [filterMode, setFilterMode] = useState<'month' | 'year'>('month');

  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;

  // Add/Edit modal state
  const [addType, setAddType] = useState<'entrata' | 'spesa'>('spesa');
  const [addAmount, setAddAmount] = useState('');
  const [addCat, setAddCat] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addDate, setAddDate] = useState<Date>(new Date());
  const [editingItem, setEditingItem] = useState<any>(null);

  // Periodic expenses state
  const [isPeriodic, setIsPeriodic] = useState(false);
  const [periodInterval, setPeriodInterval] = useState(1);
  const [periodUnit, setPeriodUnit] = useState('months');

  // Category details modal state
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchIncomes();
      fetchExpenses();
    }
  }, [token, fetchCategories, fetchIncomes, fetchExpenses]);

  const fetchMe = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) setUser(await res.json());
      else logout();
    } catch { logout(); }
    finally { setLoading(false); }
  };

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

  const openAddModal = () => {
    setEditingItem(null);
    setAddAmount(''); setAddCat(''); setAddDesc('');
    setAddDate(new Date());
    setIsPeriodic(false);
    setPeriodInterval(1);
    setPeriodUnit('months');
    setShowAddModal(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setAddType(activeTab === 'uscite' ? 'spesa' : 'entrata');
    setAddAmount(item.amount.toString());
    setAddCat(item.category_id.toString());
    setAddDesc(item.description);
    setAddDate(new Date(item.spent_on || item.received_on));
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    let endpoint = addType === 'entrata' ? '/incomes' : '/expenses';
    let method = 'POST';
    
    if (editingItem) {
      endpoint = `${endpoint}/${editingItem.id}`;
      method = 'PUT';
    }

    let payload: any = {
      name: categories.find(c => c.id === parseInt(addCat))?.name || t('record.item'),
      description: addDesc,
      amount: parseFloat(addAmount),
      category_id: parseInt(addCat, 10),
      [addType === 'entrata' ? 'received_on' : 'spent_on']: addDate.toISOString()
    };

    if (isPeriodic && addType === 'spesa' && !editingItem) {
      endpoint = '/periodic-expenses';
      payload = {
        name: payload.name,
        description: payload.description,
        amount: payload.amount,
        category_id: payload.category_id,
        period_interval: parseInt(periodInterval.toString(), 10),
        period_unit: periodUnit,
        start_date: addDate.toISOString()
      };
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setAddAmount(''); setAddCat(''); setAddDesc('');
        setEditingItem(null);
        setShowAddModal(false);
        if (addType === 'entrata') fetchIncomes();
        else fetchExpenses();
        toast.success(editingItem ? t('record.success_edit') : (addType === 'entrata' ? t('record.success_income') : t('record.success_expense')), {
          style: { borderRadius: '12px', background: '#333', color: '#fff' }
        });
      } else {
        toast.error(editingItem ? t('record.error_save') : t('record.error_save'));
      }
    } catch (err) { 
      console.error(err); 
      toast.error(t('record.error_conn'));
    }
  };

  const handleDeleteRecord = async () => {
    if (!editingItem || !token) return;

    // Confirm deletion
    if (!window.confirm('Sei sicuro di voler eliminare questo elemento? / Are you sure you want to delete this item?')) return;

    const endpoint = addType === 'entrata' ? `/incomes/${editingItem.id}` : `/expenses/${editingItem.id}`;
    
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEditingItem(null);
        setShowAddModal(false);
        if (addType === 'entrata') fetchIncomes();
        else fetchExpenses();
        toast.success(t('record.success_edit') || 'Eliminato con successo / Successfully deleted', {
          style: { borderRadius: '12px', background: '#333', color: '#fff' }
        });
      } else {
        toast.error('Errore durante l\'eliminazione / Error deleting item');
      }
    } catch (err) {
      console.error(err);
      toast.error(t('record.error_conn'));
    }
  };

  if (loading) return null;

  if (token && user) {
    const isMatch = (dateString: string) => {
      const d = new Date(dateString);
      if (filterMode === 'year') {
        return d.getFullYear() === filterDate.getFullYear();
      }
      return d.getMonth() === filterDate.getMonth() && d.getFullYear() === filterDate.getFullYear();
    };

    const filteredIncomes = incomes.filter(i => isMatch(i.received_on));
    const filteredExpenses = expenses.filter(e => isMatch(e.spent_on));

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

    const getCategoryColor = (catId: number, _index: number) => {
      const category = categories.find(c => c.id === catId);
      if (category?.color) return category.color;
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16'];
      return colors[catId % colors.length];
    };



    return (
      <div className="app-container">
        <Toaster position="bottom-center" />
        <Navbar username={user.username} onLogout={logout} />
        
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
            <button className="add-btn" onClick={openAddModal}>+</button>
          </div>
        </div>

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
          {Object.entries(activeGroups).map(([catId, items], index) => {
            const category = categories.find(c => c.id === parseInt(catId));
            const catTotal = (items as any[]).reduce((sum: number, i: any) => sum + i.amount, 0);
            const percentage = activeTotal > 0 ? (catTotal / activeTotal) * 100 : 0;
            const catName = category?.name || t('dashboard.unknown');
            
            return (
              <div key={catId} className="list-item" onClick={() => setSelectedCategory(parseInt(catId))}>
                <div className="item-icon">{getIconForCategory(parseInt(catId))}</div>
                <div className="item-content">
                  <div className="item-header">
                    <div className="item-title">{catName}</div>
                    <div className="item-amount">{catTotal.toFixed(2)} €</div>
                  </div>
                  <div className="item-progress-container">
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${percentage}%`, backgroundColor: getCategoryColor(parseInt(catId), index) }}></div>
                    </div>
                    <div className="progress-text">{percentage.toFixed(2)} {t('dashboard.percentage_total')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Income/Expense Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
              
              <DatePicker
                selected={addDate}
                onChange={(date: Date | null) => date && setAddDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="d MMM yyyy, HH:mm"
                customInput={<ModalDateInput labelText={t('record.date_time')} />}
                locale={dateLocale}
                withPortal
              />

              <div className="radio-group">
                <label className="radio-label">
                  <input type="radio" name="type" checked={addType === 'entrata'} onChange={() => setAddType('entrata')} />
                  {t('record.income')}
                </label>
                <label className="radio-label">
                  <input type="radio" name="type" checked={addType === 'spesa'} onChange={() => setAddType('spesa')} />
                  {t('record.expense')}
                </label>
              </div>

              <form className="modal-form" onSubmit={handleAddSubmit}>
                <div className="input-group">
                  <label className="input-label">{t('record.amount')}</label>
                  <input type="number" step="0.01" className="input-field" placeholder={t('record.amount_placeholder')} value={addAmount} onChange={e => setAddAmount(e.target.value)} required />
                </div>
                
                <div className="input-group">
                  <label className="input-label">{t('record.category')}</label>
                  <select className="input-field" value={addCat} onChange={e => setAddCat(e.target.value)} required>
                    <option value="" disabled>{t('record.select_category')}</option>
                    {categories.filter(c => c.type === (addType === 'entrata' ? 'income' : 'expense')).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">{t('record.description')}</label>
                  <input type="text" className="input-field" placeholder={t('record.description_placeholder')} value={addDesc} onChange={e => setAddDesc(e.target.value)} />
                </div>

                {addType === 'spesa' && !editingItem && (
                  <div className="input-group" style={{ marginBottom: '16px' }}>
                    <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={isPeriodic} onChange={e => setIsPeriodic(e.target.checked)} />
                      {t('record.periodic')}
                    </label>
                    {isPeriodic && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input type="number" min="1" className="input-field" style={{ flex: 1 }} value={periodInterval} onChange={e => setPeriodInterval(parseInt(e.target.value) || 1)} />
                        <select className="input-field" style={{ flex: 2 }} value={periodUnit} onChange={e => setPeriodUnit(e.target.value)}>
                          <option value="days">{t('record.days')}</option>
                          <option value="weeks">{t('record.weeks')}</option>
                          <option value="months">{t('record.months')}</option>
                          <option value="years">{t('record.years')}</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  {editingItem && (
                    <button type="button" onClick={handleDeleteRecord} className="submit-btn" style={{ background: 'var(--danger-color)', flex: 1 }}>
                      🗑️ {t('auth.delete_account')?.split(' ')[0] || 'Delete'}
                    </button>
                  )}
                  <button type="submit" className="submit-btn" style={{ flex: 2 }}>✓ {t('record.save')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Category Details Modal */}
        {selectedCategory !== null && (
          <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedCategory(null)}>&times;</button>
              <h2 style={{ marginBottom: '24px' }}>
                {t('dashboard.details_for', { category: categories.find(c => c.id === selectedCategory)?.name || '' })}
              </h2>
              <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
                {(activeGroups[selectedCategory] || []).map((item: any) => (
                  <div key={item.id} className="list-item" style={{ padding: '12px 16px', cursor: 'pointer', marginBottom: '8px', borderRadius: '12px' }} onClick={() => {
                    setSelectedCategory(null);
                    openEditModal(item);
                  }}>
                    <div className="item-content">
                      <div className="item-header" style={{ marginBottom: '4px' }}>
                        <div className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'inherit' }}>{item.description || item.name}</span>
                          {(item as any).is_periodic && <span style={{ color: 'var(--primary-color)', fontSize: '12px', fontWeight: 'bold', padding: '2px 6px', background: 'var(--input-bg)', borderRadius: '8px' }}>{t('record.periodic') || 'Periodica'}</span>}
                        </div>
                        <div className="item-amount" style={{ color: activeTab === 'uscite' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                          {activeTab === 'uscite' ? '-' : '+'}{item.amount.toFixed(2)} €
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {format(new Date(item.spent_on || item.received_on), 'd MMM yyyy, HH:mm', { locale: dateLocale })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Login UI
  return (
    <div className="auth-wrapper">
      <Toaster position="bottom-center" />
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
