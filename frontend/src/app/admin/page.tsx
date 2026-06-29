'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/i18n/LanguageContext';
import { API_BASE } from '@/utils/api';
import toast, { Toaster } from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  is_admin?: boolean;
}

export default function AdminPage() {
  const { token, user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (user && !user.is_admin) {
      window.location.href = '/';
    }
  }, [user]);

  useEffect(() => {
    if (token && user?.is_admin) {
      fetchUsers();
    }
  }, [token, user]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleResetPassword = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}/reset-password`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${t('admin.reset_success')} ${data.temp_password}`, { duration: 10000 });
      } else {
        toast.error('Error resetting password');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error resetting password');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!token) return;
    if (!confirm(t('admin.confirm_delete'))) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
        toast.success('User deleted');
      } else {
        toast.error('Error deleting user');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting user');
    }
  };

  if (loading || !user || !user.is_admin) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div className="app-container">
      <Toaster position="bottom-center" />
      <Navbar username={user.username} onLogout={logout} isAdmin={user.is_admin} />
      
      <div style={{ padding: '24px 20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>
          {t('admin.title')}
        </h2>
        
        {loadingUsers ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="glass-container" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px' }}>{t('admin.id')}</th>
                  <th style={{ padding: '12px' }}>{t('admin.username')}</th>
                  <th style={{ padding: '12px' }}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>{u.id}</td>
                    <td style={{ padding: '12px' }}>{u.username} {u.is_admin && <span style={{fontSize: '12px', padding: '2px 6px', background: 'var(--primary-color)', color: 'white', borderRadius: '10px', marginLeft: '8px'}}>ADMIN</span>}</td>
                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleResetPassword(u.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '14px' }}
                      >
                        {t('admin.reset_password')}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === user.id} // prevent self-delete
                        style={{ padding: '6px 12px', fontSize: '14px', background: u.id === user.id ? 'var(--border-color)' : 'var(--danger-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: u.id === user.id ? 'not-allowed' : 'pointer' }}
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
    </div>
  );
}
