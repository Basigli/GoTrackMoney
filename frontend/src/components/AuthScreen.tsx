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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!isLogin && password !== confirmPassword) {
      toast.error(t('auth.passwords_do_not_match'));
      return;
    }
    setBusy(true);
    try {
      await authenticate(isLogin ? 'login' : 'register', username, password);
      toast.success(t(isLogin ? 'auth.login_success' : 'auth.register_success'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) toast.error(t('auth.invalid_credentials'));
      else if (error instanceof ApiError && error.status === 409) toast.error(t('auth.username_taken'));
      else toast.error(error instanceof ApiError ? error.body || t('record.error_conn') : t('record.error_conn'));
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-wrapper">
    <div className="glass-container">
      <h1 className="form-title">{t(isLogin ? 'auth.login' : 'auth.register')}</h1>
      <p className="form-subtitle">{t(isLogin ? 'auth.login_subtitle' : 'auth.register_subtitle')}</p>
      <form onSubmit={submit}>
        <input className="input-field" type="text" autoComplete="username" placeholder={t('auth.username')} value={username} onChange={event => setUsername(event.target.value)} required />
        <div className={styles.passwordField}>
          <input className="input-field" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={t('auth.password')} value={password} onChange={event => setPassword(event.target.value)} required />
          <button type="button" className={styles.passwordToggle} aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')} onClick={() => setShowPassword(value => !value)}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
        </div>
        {!isLogin && <div className={styles.confirmPasswordField}>
          <input className={`input-field ${styles.confirmInput}`} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={t('auth.confirm_password')} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
          <button type="button" className={styles.passwordToggle} aria-label={showConfirmPassword ? t('auth.hide_password') : t('auth.show_password')} onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</button>
        </div>}
        <button type="submit" className="submit-btn" disabled={busy}>{t(isLogin ? 'auth.login' : 'auth.register')}</button>
      </form>
      <div className={styles.footer}>
        <button type="button" onClick={() => setIsLogin(value => !value)} className="toggle-auth-btn">{t(isLogin ? 'auth.no_account' : 'auth.have_account')}</button>
      </div>
    </div>
  </div>;
}
