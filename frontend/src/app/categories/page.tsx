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
  
  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316', '#ef4444', '#14b8a6', '#f43f5e', '#84cc16'];
  const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
  const getStableColor = (id: number) => COLORS[id % COLORS.length];

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState(getRandomColor());
  const [filter, setFilter] = useState('');
  const [editingCategory, setEditingCategory] = useState<any>(null);

  useEffect(() => {
    if (token) fetchCategories();
  }, [token, fetchCategories]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8098` : 'http://localhost:8098');
    const endpoint = editingCategory ? `${API_BASE}/categories/${editingCategory.id}` : `${API_BASE}/categories`;
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, emoji, type, color })
      });
      if (res.ok) {
        setName('');
        setEmoji('📝');
        setColor(getRandomColor());
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
    setColor(cat.color || getStableColor(cat.id));
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
      
      <div style={{ padding: '24px 20px', marginBottom: '24px' }}>
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
            <div style={{ flex: '0 0 60px' }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-color)' }}>Colore</label>
              <div style={{ width: '100%', height: '52px', borderRadius: '16px', overflow: 'hidden', border: 'none', cursor: 'pointer', background: 'none' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: '100%', padding: '0', background: 'none', border: 'none', cursor: 'pointer' }} />
              </div>
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
              <button type="button" onClick={() => { setEditingCategory(null); setName(''); setEmoji('📝'); setColor(getRandomColor()); }} style={{ background: 'var(--input-bg)', color: 'var(--text-color)', flex: '0 0 auto', padding: '16px 24px', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
                {t('categories.cancel_btn')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ padding: '24px 20px', marginBottom: '40px' }}>
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
            <div className="list-container">
              {expenseCategories.map(c => (
                <div key={c.id} className="list-item" onClick={() => handleEditClick(c)} style={{ padding: '16px 20px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: c.color || getStableColor(c.id) }}></div>
                  <span style={{ fontSize: '24px', marginRight: '16px', marginLeft: '6px' }}>{c.emoji || '📝'}</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{c.name}</span>
                </div>
              ))}
              {expenseCategories.length === 0 && <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>{t('categories.no_categories')}</div>}
            </div>
          </div>
          
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--success-color)' }}>{t('categories.incomes_list')}</h3>
            <div className="list-container">
              {incomeCategories.map(c => (
                <div key={c.id} className="list-item" onClick={() => handleEditClick(c)} style={{ padding: '16px 20px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: c.color || getStableColor(c.id) }}></div>
                  <span style={{ fontSize: '24px', marginRight: '16px', marginLeft: '6px' }}>{c.emoji || '📝'}</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{c.name}</span>
                </div>
              ))}
              {incomeCategories.length === 0 && <div style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>{t('categories.no_categories')}</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
