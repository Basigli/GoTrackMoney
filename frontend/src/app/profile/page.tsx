'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/i18n/LanguageContext';
import toast, { Toaster } from 'react-hot-toast';

const API_BASE = 'http://localhost:8080';

export default function ProfilePage() {
  const { token, user, loading, logout } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionDurationHours, setSessionDurationHours] = useState<number>(24);

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
              <input 
                className="input-field" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Nuova password..."
              />
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
        </div>
      </div>
    </div>
  );
}
