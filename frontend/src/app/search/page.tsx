'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import Navbar from '@/components/Navbar';
import { ModalDateInput } from '@/components/DateInputs';
import { useLanguage } from '@/i18n/LanguageContext';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import toast, { Toaster } from 'react-hot-toast';
import { FormEvent, forwardRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function SearchPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, incomes, expenses, fetchCategories, fetchIncomes, fetchExpenses } = useData(token);
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'expenses' | 'incomes'>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Add/Edit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'entrata' | 'spesa'>('spesa');
  const [addAmount, setAddAmount] = useState('');
  const [addCat, setAddCat] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addDate, setAddDate] = useState<Date>(new Date());
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isPeriodic, setIsPeriodic] = useState(false);
  const [periodInterval, setPeriodInterval] = useState(1);
  const [periodUnit, setPeriodUnit] = useState('months');

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setAddType(item.isExpense ? 'spesa' : 'entrata');
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

  const loadMore = async () => {
    const nextOffset = offset + 100;
    const [inc, exp] = await Promise.all([
      fetchIncomes(nextOffset),
      fetchExpenses(nextOffset)
    ]);
    setOffset(nextOffset);
    if ((inc?.length || 0) < 100 && (exp?.length || 0) < 100) {
      setHasMore(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchIncomes();
      fetchExpenses();
    }
  }, [token, fetchCategories, fetchIncomes, fetchExpenses]);

  if (loading) return null;
  if (!user) return null;

  const getIconForCategory = (catId: number) => {
    const category = categories.find(c => c.id === catId);
    return category?.emoji || '📝';
  };

  const getCategoryName = (catId: number) => {
    const category = categories.find(c => c.id === catId);
    return category?.name || t('dashboard.unknown');
  };

  const allItems = [
    ...expenses.map(e => ({ ...e, isExpense: true, date: e.spent_on })),
    ...incomes.map(i => ({ ...i, isExpense: false, date: i.received_on }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const queryLower = searchQuery.toLowerCase();
  const queryNumber = parseFloat(searchQuery.replace(',', '.'));

  const matches = allItems.filter(item => {
    if (searchType === 'expenses' && !item.isExpense) return false;
    if (searchType === 'incomes' && item.isExpense) return false;
    
    if (!searchQuery) return true;
    
    const textMatch = item.name.toLowerCase().includes(queryLower) || 
                      (item.description || '').toLowerCase().includes(queryLower) ||
                      getCategoryName(item.category_id).toLowerCase().includes(queryLower);
                      
    const amountMatch = !isNaN(queryNumber) && item.amount === queryNumber;
    
    return textMatch || amountMatch;
  });



  return (
    <div className="app-container">
      <Toaster position="bottom-center" />
      <Navbar username={user.username} onLogout={logout} />
      
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>
          {t('nav.search')}
        </h2>
        <input 
          type="text" 
          placeholder={t('dashboard.search')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '16px 20px', background: 'var(--input-bg)', border: 'none', borderRadius: '16px', fontSize: '16px', color: 'var(--text-color)', marginBottom: '16px' }}
        />

        <div className="tabs" style={{ marginBottom: 0 }}>
          <div className={`tab ${searchType === 'all' ? 'active' : ''}`} onClick={() => setSearchType('all')}>{t('search.all')}</div>
          <div className={`tab ${searchType === 'expenses' ? 'active' : ''}`} onClick={() => setSearchType('expenses')}>{t('dashboard.expenses')}</div>
          <div className={`tab ${searchType === 'incomes' ? 'active' : ''}`} onClick={() => setSearchType('incomes')}>{t('dashboard.incomes')}</div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
          {t('search.results_count').replace('{count}', matches.length.toString())}
        </p>
        
        <div className="list-container">
          {matches.map(item => (
            <div key={`${item.isExpense ? 'exp' : 'inc'}-${item.id}`} className="list-item" onClick={() => openEditModal(item)} style={{ padding: '16px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div className="item-icon" style={{ fontSize: '24px', marginRight: '16px' }}>{getIconForCategory(item.category_id)}</div>
              <div className="item-content" style={{ flex: 1 }}>
                <div className="item-header" style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <div className="item-title" style={{ fontWeight: 600 }}>{item.description || item.name}</div>
                  <div className="item-amount" style={{ color: item.isExpense ? 'var(--danger-color)' : 'var(--success-color)', fontWeight: 600 }}>
                    {item.isExpense ? '-' : '+'}{item.amount.toFixed(2)} €
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{getCategoryName(item.category_id)}</span>
                  <span>{format(new Date(item.date), 'd MMM yyyy, HH:mm', { locale: dateLocale })}</span>
                </div>
              </div>
            </div>
          ))}
          {matches.length === 0 && <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_data')}</div>}
          
          {hasMore && matches.length >= 100 && (
            <button 
              onClick={loadMore} 
              style={{ gridColumn: '1 / -1', width: '100%', padding: '16px', marginTop: '16px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
            >
              {t('search.load_more')}
            </button>
          )}
        </div>
      </div>

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
                <input type="radio" name="type" checked={addType === 'entrata'} onChange={() => setAddType('entrata')} disabled={!!editingItem} />
                {t('record.income')}
              </label>
              <label className="radio-label">
                <input type="radio" name="type" checked={addType === 'spesa'} onChange={() => setAddType('spesa')} disabled={!!editingItem} />
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
    </div>
  );
}
