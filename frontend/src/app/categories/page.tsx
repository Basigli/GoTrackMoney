'use client';

import { useState, useEffect, FormEvent } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import toast, { Toaster } from 'react-hot-toast';
import { useLanguage } from '@/i18n/LanguageContext';

export default function CategoriesPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, fetchCategories } = useData(token);
  const { t } = useLanguage();
  
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [filter, setFilter] = useState('');
  const [editingCategory, setEditingCategory] = useState<any>(null);

  useEffect(() => {
    if (token) fetchCategories();
  }, [token, fetchCategories]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    const endpoint = editingCategory ? `http://localhost:8080/categories/${editingCategory.id}` : `http://localhost:8080/categories`;
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, emoji, type })
      });
      if (res.ok) {
        setName('');
        setEmoji('📝');
        setEditingCategory(null);
        toast.success(editingCategory ? t('categories.success_update') : t('categories.success_create'));
        fetchCategories();
      } else {
        toast.error(t('categories.error_save'));
      }
    } catch (err) { 
      console.error(err);
      toast.error(t('categories.error_save'));
    }
  };

  const handleEditClick = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setEmoji(cat.emoji || '📝');
    setType(cat.type || 'expense');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return null;
  if (!user) return null;

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
  const incomeCategories = filteredCategories.filter(c => c.type === 'income');
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense');

  return (
    <div className="app-container">
      <Toaster position="bottom-center" />
      <Navbar username={user.username} onLogout={logout} />
      
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>
          {editingCategory ? t('categories.edit') : t('categories.new')}
        </h2>
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
          
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: '0 0 60px' }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-color)' }}>{t('categories.emoji')}</label>
              <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} style={{ width: '100%', padding: '16px 0', textAlign: 'center', background: 'var(--input-bg)', border: 'none', borderRadius: '16px', fontSize: '24px' }} required />
            </div>
            <div style={{ flex: '1' }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-color)' }}>{t('categories.name')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '16px 20px', background: 'var(--input-bg)', border: 'none', borderRadius: '16px', fontSize: '16px', color: 'var(--text-color)' }} placeholder={t('categories.name_placeholder')} required />
            </div>
          </div>

          <div className="radio-group" style={{ marginBottom: '24px', display: 'flex', gap: '24px' }}>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="catType" checked={type === 'expense'} onChange={() => setType('expense')} />
              {t('categories.type_expense')}
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="catType" checked={type === 'income'} onChange={() => setType('income')} />
              {t('categories.type_income')}
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="submit-btn" style={{ background: 'var(--primary-color)', color: 'white', flex: 1, padding: '16px', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
              {editingCategory ? t('categories.save_btn') : t('categories.add_btn')}
            </button>
            {editingCategory && (
              <button type="button" onClick={() => { setEditingCategory(null); setName(''); setEmoji('📝'); }} style={{ background: 'var(--input-bg)', color: 'var(--text-color)', flex: '0 0 auto', padding: '16px 24px', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
                {t('categories.cancel_btn')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ padding: '0 20px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>{t('categories.my_categories')}</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder={t('categories.search')}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: '100%', padding: '16px 20px', background: 'var(--input-bg)', border: 'none', borderRadius: '16px', fontSize: '16px', color: 'var(--text-color)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--danger-color)' }}>{t('categories.expenses_list')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expenseCategories.map(c => (
                <div key={c.id} onClick={() => handleEditClick(c)} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '24px', marginRight: '16px' }}>{c.emoji || '📝'}</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{c.name}</span>
                </div>
              ))}
              {expenseCategories.length === 0 && <div style={{ color: 'var(--text-muted)' }}>{t('categories.no_categories')}</div>}
            </div>
          </div>
          
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--success-color)' }}>{t('categories.incomes_list')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {incomeCategories.map(c => (
                <div key={c.id} onClick={() => handleEditClick(c)} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '24px', marginRight: '16px' }}>{c.emoji || '📝'}</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{c.name}</span>
                </div>
              ))}
              {incomeCategories.length === 0 && <div style={{ color: 'var(--text-muted)' }}>{t('categories.no_categories')}</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
