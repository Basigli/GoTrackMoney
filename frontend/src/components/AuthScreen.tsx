'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useSession } from '@/auth/SessionContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { ApiError } from '@/utils/api';
import styles from './AuthScreen.module.css';

export default function AuthScreen() {
  const { authenticate } = useSession();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field: 'username' | 'credentials' | 'confirmation' | 'form' } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!isLogin && password !== confirmPassword) {
      setError({ message: t('auth.passwords_do_not_match'), field: 'confirmation' });
      return;
    }
    setBusy(true);
    try {
      await authenticate(isLogin ? 'login' : 'register', username, password);
      toast.success(t(isLogin ? 'auth.login_success' : 'auth.register_success'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setError({ message: t('auth.invalid_credentials'), field: 'credentials' });
      else if (error instanceof ApiError && error.status === 409) setError({ message: t('auth.username_taken'), field: 'username' });
      else setError({ message: t('record.error_conn'), field: 'form' });
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-wrapper">
    <div className="glass-container">
      <h1 className="form-title">{t(isLogin ? 'auth.login' : 'auth.register')}</h1>
      <p className="form-subtitle">{t(isLogin ? 'auth.login_subtitle' : 'auth.register_subtitle')}</p>
      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="auth-username">{t('auth.username')}</label>
        <input id="auth-username" className="input-field" type="text" autoComplete="username" placeholder={t('auth.username')} value={username} onChange={event => { setUsername(event.target.value); setError(null); }} required disabled={busy}
          aria-invalid={error?.field === 'username' || error?.field === 'credentials'} aria-describedby={error?.field === 'username' || error?.field === 'credentials' ? 'auth-error' : undefined} />
        <label className={styles.label} htmlFor="auth-password">{t('auth.password')}</label>
        <div className={styles.passwordField}>
          <input id="auth-password" className="input-field" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={t('auth.password')} value={password} onChange={event => { setPassword(event.target.value); setError(null); }} required disabled={busy}
            aria-invalid={error?.field === 'credentials'} aria-describedby={error?.field === 'credentials' ? 'auth-error' : undefined} />
          <button type="button" className={styles.passwordToggle} aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')} onClick={() => setShowPassword(value => !value)}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
        </div>
        {!isLogin && <>
          <label className={styles.label} htmlFor="auth-confirm-password">{t('auth.confirm_password')}</label>
          <div className={styles.confirmPasswordField}>
          <input id="auth-confirm-password" className={`input-field ${styles.confirmInput}`} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={t('auth.confirm_password')} value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setError(null); }} required disabled={busy}
            aria-invalid={error?.field === 'confirmation'} aria-describedby={error?.field === 'confirmation' ? 'auth-error' : undefined} />
          <button type="button" className={styles.passwordToggle} aria-label={showConfirmPassword ? t('auth.hide_password') : t('auth.show_password')} onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</button>
        </div></>}
        {error && <p id="auth-error" role="alert" className="field-error">{error.message}</p>}
        <button type="submit" className="submit-btn" disabled={busy}>{t(isLogin ? 'auth.login' : 'auth.register')}</button>
      </form>
      <div className={styles.footer}>
        <button type="button" disabled={busy} onClick={() => { setIsLogin(value => !value); setError(null); }} className="toggle-auth-btn">{t(isLogin ? 'auth.no_account' : 'auth.have_account')}</button>
      </div>
    </div>
  </div>;
}
