'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/auth/SessionContext';
import AppShell from '@/components/AppShell';
import SafeDialog from '@/components/SafeDialog';
import styles from './Profile.module.css';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/i18n/ThemeContext';
import toast from 'react-hot-toast';

import { apiRequest, ApiError } from '@/utils/api';
import type { SessionUser } from '@/types/domain';

export default function ProfilePage() {
  const { token, user, loading, logout } = useAuth();
  if (loading || !user || !token) return null;
  return <ProfileContent key={user.id} token={token} user={user} logout={logout} />;
}

function ProfileContent({ token, user, logout }: { token: string; user: SessionUser; logout: () => void }) {
  const { updateUser } = useSession();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionDurationHours, setSessionDurationHours] = useState<number>(user.session_duration_hours || 24);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const updated = await apiRequest<SessionUser>('/users/me', {
        method: 'PUT', token,
        body: { username, password, session_duration_hours: Number(sessionDurationHours) },
      });
      updateUser(updated);
      toast.success(t('auth.update_success'));
      setPassword('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) toast.error(t('auth.username_taken'));
      else toast.error(error instanceof ApiError ? error.body || t('record.error_save') : t('record.error_conn'));
    }
  };

  const handleDeleteAccount = async () => {
    const expectedPhrase = language === 'it' ? 'elimina il mio account' : 'delete my account';
    if (deleteConfirmText !== expectedPhrase) {
      toast.error('Phrase does not match / La frase non coincide');
      return;
    }

    try {
      await apiRequest<void>('/users/me', { method: 'DELETE', token });
      toast.success(t('auth.delete_success') || 'Account deleted');
      logout();
    } catch {
      toast.error(t('record.error_conn'));
    }
  };

  return (
    <AppShell>
      
      <div className={styles.content}>
        <div className={`glass-container ${styles.card}`}>
          <h1 className="form-title">{t('auth.profile')}</h1>
          <p className="form-subtitle">Aggiorna le tue informazioni (Update your info)</p>
          
          <form onSubmit={handleSubmit}>
            <div className={styles.firstField}>
              <label className={styles.label} htmlFor="profile-username">{t('auth.username')}</label>
              <input 
                id="profile-username"
                className="input-field" 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="profile-password">{t('auth.password')} (Lascia vuoto per non cambiare / Leave blank to keep)</label>
              <div className={styles.passwordField}>
                <input 
                  id="profile-password"
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Nuova password..."
                  className={`input-field ${styles.passwordInput}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.passwordToggle} aria-label={t(showPassword ? 'auth.hide_password' : 'auth.show_password')}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="profile-session-duration">{t('auth.session_duration')} (Ore / Hours)</label>
              <input 
                id="profile-session-duration"
                className="input-field" 
                type="number" 
                min="1"
                max="8760"
                value={sessionDurationHours} 
                onChange={e => setSessionDurationHours(parseInt(e.target.value) || 24)} 
                required
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Lingua / Language</span>
              <div className={styles.choiceGroup} role="group" aria-label="Lingua / Language">
                <button type="button" onClick={() => setLanguage('it')} className={language === 'it' ? styles.active : ''}>Italiano</button>
                <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? styles.active : ''}>English</button>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>{t('profile.theme')}</span>
              <div className={styles.choiceGroup} role="group" aria-label={t('profile.theme')}>
                <button type="button" className={theme === 'light' ? styles.active : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>{t('profile.light')}</button>
                <button type="button" className={theme === 'dark' ? styles.active : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>{t('profile.dark')}</button>
              </div>
              <p className={styles.note}>{t('profile.theme_note')}</p>
            </div>

            <button type="submit" className={`submit-btn ${styles.saveButton}`}>{t('auth.save_profile')}</button>
          </form>

          <div className={styles.dangerZone}>
            <h2 className={styles.dangerTitle}>Zona Pericolosa</h2>
            <p className={styles.dangerNote}>{t('auth.delete_warning') || 'Warning: This action is irreversible and will delete all your data.'}</p>
            <button 
              type="button"
              onClick={() => setShowDeleteModal(true)} 
              className={styles.deleteButton}
            >
              {t('auth.delete_account') || 'Delete Account'}
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <SafeDialog title={t('auth.delete_account')} onClose={() => setShowDeleteModal(false)} dirty={deleteConfirmText.length > 0} showCancel={false} className={styles.deleteDialog}>
            <p className={styles.deleteWarning}>
              {t('auth.delete_warning') || 'Warning: This action is irreversible and will delete all your data.'}
            </p>
            <p className={styles.deleteInstructions}>
              {(t('auth.delete_instructions') || 'Type "%{phrase}" to confirm:').replace('%{phrase}', language === 'it' ? 'elimina il mio account' : 'delete my account')}
            </p>
            <input 
              type="text" 
              data-initial-focus
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={language === 'it' ? 'elimina il mio account' : 'delete my account'}
              className={`input-field ${styles.deleteInput}`}
            />
            <div className={styles.deleteActions}>
              <button 
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className={styles.cancelDelete}
              >
                {t('auth.cancel') || 'Cancel'}
              </button>
              <button 
                type="button"
                onClick={handleDeleteAccount}
                className={styles.confirmDelete}
              >
                {t('auth.delete_account') || 'Delete Account'}
              </button>
            </div>
        </SafeDialog>
      )}
    </AppShell>
  );
}
