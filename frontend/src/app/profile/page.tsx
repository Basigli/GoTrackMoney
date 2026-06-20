'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/i18n/LanguageContext';
import toast, { Toaster } from 'react-hot-toast';

import { API_BASE } from '@/utils/api';

export default function ProfilePage() {
  const { token, user, loading, logout } = useAuth();
  const { t, language } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionDurationHours, setSessionDurationHours] = useState<number>(24);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setSessionDurationHours(user.session_duration_hours || 24);
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username, password, session_duration_hours: Number(sessionDurationHours) })
      });

      if (res.ok) {
        toast.success(t('auth.update_success'), {
          style: { borderRadius: '12px', background: '#333', color: '#fff' }
        });
        // Clear password field after success
        setPassword('');
        // Update local storage user data optionally (handled by re-fetching on next load or context)
      } else {
        const text = await res.text();
        if (res.status === 409) {
          toast.error(t('auth.username_taken'));
        } else {
          toast.error(text || t('record.error_save'));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(t('record.error_conn'));
    }
  };

  const handleDeleteAccount = async () => {
    const expectedPhrase = language === 'it' ? 'elimina il mio account' : 'delete my account';
    if (deleteConfirmText !== expectedPhrase) {
      toast.error('Phrase does not match / La frase non coincide');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(t('auth.delete_success') || 'Account deleted');
        logout();
      } else {
        toast.error('Error deleting account');
      }
    } catch (err) {
      console.error(err);
      toast.error(t('record.error_conn'));
    }
  };

  if (loading || !user) return null;

  return (
    <div className="app-container">
      <Toaster position="bottom-center" />
      <Navbar username={user.username} onLogout={logout} />
      
      <div style={{ padding: '40px 20px', maxWidth: '500px', margin: '0 auto' }}>
        <div className="glass-container" style={{ margin: 0, maxWidth: '100%' }}>
          <h1 className="form-title">{t('auth.profile')}</h1>
          <p className="form-subtitle">Aggiorna le tue informazioni (Update your info)</p>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>{t('auth.username')}</label>
              <input 
                className="input-field" 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>{t('auth.password')} (Lascia vuoto per non cambiare / Leave blank to keep)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="input-field" 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Nuova password..."
                  style={{ margin: 0 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>{t('auth.session_duration')} (Ore / Hours)</label>
              <input 
                className="input-field" 
                type="number" 
                min="1"
                max="8760"
                value={sessionDurationHours} 
                onChange={e => setSessionDurationHours(parseInt(e.target.value) || 24)} 
                required
              />
            </div>

            <button type="submit" className="submit-btn">{t('auth.save_profile')}</button>
          </form>

          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--danger-color)', marginBottom: '8px' }}>Zona Pericolosa</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>{t('auth.delete_warning') || 'Warning: This action is irreversible and will delete all your data.'}</p>
            <button 
              onClick={() => setShowDeleteModal(true)} 
              style={{ background: 'var(--danger-color)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, width: '100%' }}
            >
              {t('auth.delete_account') || 'Delete Account'}
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--danger-color)', marginBottom: '16px' }}>{t('auth.delete_account') || 'Delete Account'}</h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
              {t('auth.delete_warning') || 'Warning: This action is irreversible and will delete all your data.'}
            </p>
            <p style={{ marginBottom: '8px', fontWeight: 500 }}>
              {(t('auth.delete_instructions') || 'Type "%{phrase}" to confirm:').replace('%{phrase}', language === 'it' ? 'elimina il mio account' : 'delete my account')}
            </p>
            <input 
              type="text" 
              className="input-field" 
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={language === 'it' ? 'elimina il mio account' : 'delete my account'}
              style={{ marginBottom: '24px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-color)', cursor: 'pointer' }}
              >
                {t('auth.cancel') || 'Cancel'}
              </button>
              <button 
                onClick={handleDeleteAccount}
                style={{ flex: 1, padding: '12px', background: 'var(--danger-color)', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                {t('auth.delete_account') || 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
