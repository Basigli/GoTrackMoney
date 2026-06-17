'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/i18n/LanguageContext';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

export default function SearchPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, incomes, expenses, fetchCategories, fetchIncomes, fetchExpenses } = useData(token);
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'expenses' | 'incomes'>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

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
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {matches.map(item => (
            <div key={`${item.isExpense ? 'exp' : 'inc'}-${item.id}`} className="list-item" style={{ padding: '16px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
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
              style={{ width: '100%', padding: '16px', marginTop: '16px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
            >
              {t('search.load_more')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
