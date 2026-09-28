'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AppShell from '@/components/AppShell';
import styles from './Admin.module.css';
import { useLanguage } from '@/i18n/LanguageContext';
import { apiRequest } from '@/utils/api';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  is_admin?: boolean;
}

export default function AdminPage() {
  const { token, user, loading } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      setUsers(await apiRequest<User[]>('/users', { token }));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user?.is_admin) void Promise.resolve().then(fetchUsers);
  }, [token, user?.is_admin, fetchUsers]);

  const handleResetPassword = async (id: number) => {
    if (!token) return;
    try {
      const data = await apiRequest<{ temp_password: string }>(`/admin/users/${id}/reset-password`, { method: 'PUT', token });
      toast.success(`${t('admin.reset_success')} ${data.temp_password}`, { duration: 10000 });
    } catch {
      toast.error('Error resetting password');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!token) return;
    if (!confirm(t('admin.confirm_delete'))) return;
    
    try {
      await apiRequest<void>(`/admin/users/${id}`, { method: 'DELETE', token });
      setUsers(current => current.filter(u => u.id !== id));
      toast.success('User deleted');
    } catch {
      toast.error('Error deleting user');
    }
  };

  if (loading || !user || !user.is_admin) return null;

  return (
    <AppShell>
      
      <div className={styles.content}>
        <h2 className={styles.title}>
          {t('admin.title')}
        </h2>
        
        {loadError && <p role="alert">{t('analytics.load_error')} <button type="button" className="secondary-btn" onClick={() => { setLoadingUsers(true); void fetchUsers(); }}>{t('analytics.retry')}</button></p>}
        {loadingUsers ? (
          <p role="status">{t('analytics.loading')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('admin.id')}</th>
                  <th>{t('admin.username')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username} {u.is_admin && <span className={styles.badge}>ADMIN</span>}</td>
                    <td className={styles.actions}>
                      <button 
                        type="button"
                        onClick={() => handleResetPassword(u.id)}
                        className={`secondary-btn ${styles.actionButton}`}
                      >
                        {t('admin.reset_password')}
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === user.id} // prevent self-delete
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                      >
                        {t('admin.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
