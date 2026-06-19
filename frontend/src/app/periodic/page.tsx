'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useData, PeriodicExpense } from '@/hooks/useData';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/i18n/LanguageContext';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function PeriodicPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, periodicExpenses, fetchCategories, fetchPeriodicExpenses } = useData(token);
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PeriodicExpense | null>(null);
  
  const [periodInterval, setPeriodInterval] = useState(1);
  const [periodUnit, setPeriodUnit] = useState('months');

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchPeriodicExpenses();
    }
  }, [token, fetchCategories, fetchPeriodicExpenses]);

  if (loading) return null;
  if (!user) return null;

  const getIconForCategory = (catId: number) => {
    const category = categories.find(c => c.id === catId);
    return category?.emoji || '📝';
  };

  const getCategoryName = (catId: number) => {
    const category = categories.find(c => c.id === catId);
    return category?.name || t('dashboard.unknown') || 'Unknown';
  };

  const openEditModal = (item: PeriodicExpense) => {
    setEditingItem(item);
    setPeriodInterval(item.period_interval);
    setPeriodUnit(item.period_unit);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !editingItem) return;

    try {
      const res = await fetch(`${API_BASE}/periodic-expenses/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          period_interval: periodInterval,
          period_unit: periodUnit
        })
      });
      if (res.ok) {
        setEditingItem(null);
        setShowEditModal(false);
        fetchPeriodicExpenses();
        toast.success(t('record.success_edit') || 'Successfully updated', {
          style: { borderRadius: '12px', background: '#333', color: '#fff' }
        });
      } else {
        toast.error(t('record.error_save') || 'Error saving');
      }
    } catch (err) {
      console.error(err);
      toast.error(t('record.error_conn') || 'Connection error');
    }
  };

  const handleDeleteRecord = async () => {
    if (!editingItem || !token) return;

    if (!window.confirm('Sei sicuro di voler eliminare questa spesa periodica? / Are you sure you want to delete this periodic expense?')) return;

    try {
      const res = await fetch(`${API_BASE}/periodic-expenses/${editingItem.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEditingItem(null);
        setShowEditModal(false);
        fetchPeriodicExpenses();
        toast.success(t('record.success_edit') || 'Eliminato con successo / Successfully deleted', {
          style: { borderRadius: '12px', background: '#333', color: '#fff' }
        });
      } else {
        toast.error('Errore durante l\'eliminazione / Error deleting item');
      }
    } catch (err) {
      console.error(err);
      toast.error(t('record.error_conn') || 'Connection error');
    }
  };

  return (
    <div className="app-container">
      <Toaster position="bottom-center" />
      <Navbar username={user.username} onLogout={logout} />
      
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>
          {t('record.periodic') || 'Spese Periodiche'}
        </h2>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div className="list-container">
          {periodicExpenses.map(item => (
            <div key={item.id} className="list-item" onClick={() => openEditModal(item)} style={{ padding: '16px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div className="item-icon" style={{ fontSize: '24px', marginRight: '16px' }}>{getIconForCategory(item.category_id)}</div>
              <div className="item-content" style={{ flex: 1 }}>
                <div className="item-header" style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <div className="item-title" style={{ fontWeight: 600, color: 'inherit' }}>
                    {item.description || item.name}
                  </div>
                  <div className="item-amount" style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                    -{item.amount.toFixed(2)} €
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{getCategoryName(item.category_id)} • Ogni {item.period_interval} {item.period_unit}</span>
                  <span>Prossima: {format(new Date(item.next_due_date), 'd MMM yyyy', { locale: dateLocale })}</span>
                </div>
              </div>
            </div>
          ))}
          {periodicExpenses.length === 0 && <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.no_data')}</div>}
        </div>
      </div>

      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            <h2 style={{ marginBottom: '24px' }}>Modifica Periodicità</h2>
            <form className="modal-form" onSubmit={handleEditSubmit}>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input type="number" min="1" className="input-field" style={{ flex: 1 }} value={periodInterval} onChange={e => setPeriodInterval(parseInt(e.target.value) || 1)} />
                  <select className="input-field" style={{ flex: 2 }} value={periodUnit} onChange={e => setPeriodUnit(e.target.value)}>
                    <option value="days">{t('record.days') || 'Giorni'}</option>
                    <option value="weeks">{t('record.weeks') || 'Settimane'}</option>
                    <option value="months">{t('record.months') || 'Mesi'}</option>
                    <option value="years">{t('record.years') || 'Anni'}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={handleDeleteRecord} className="submit-btn" style={{ background: 'var(--danger-color)', flex: 1 }}>
                  🗑️ {t('auth.delete_account')?.split(' ')[0] || 'Elimina'}
                </button>
                <button type="submit" className="submit-btn" style={{ flex: 2 }}>✓ {t('record.save') || 'Salva'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
