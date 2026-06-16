'use client';

import { useState, useEffect, FormEvent } from 'react';
import Navbar from '@/components/Navbar';
import { useData } from '@/hooks/useData';

const API_BASE = 'http://localhost:8080';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{id: number, username: string} | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { fetchCategories, fetchIncomes, fetchExpenses, incomes, expenses } = useData(token);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchIncomes();
      fetchExpenses();
    }
  }, [token, fetchCategories, fetchIncomes, fetchExpenses]);

  const fetchMe = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        setUser(await res.json());
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/auth/login' : '/users';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Authentication failed');
      }
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err: any) { setError(err.message); }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  if (loading) return null;

  if (token && user) {
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncome - totalExpense;

    return (
      <div className="dashboard-container">
        <Navbar username={user.username} onLogout={logout} />
        
        <div className="card">
          <h2 className="card-title">Overview</h2>
          <div className="grid-layout">
            <div className="card group-card" style={{ cursor: 'default' }}>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Total Balance</div>
              <div className="amount" style={{ fontSize: '32px' }}>${balance.toFixed(2)}</div>
            </div>
            <div className="card group-card" style={{ cursor: 'default' }}>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Total Incomes</div>
              <div className="amount income" style={{ fontSize: '32px' }}>+${totalIncome.toFixed(2)}</div>
            </div>
            <div className="card group-card" style={{ cursor: 'default' }}>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Total Expenses</div>
              <div className="amount expense" style={{ fontSize: '32px' }}>-${totalExpense.toFixed(2)}</div>
            </div>
          </div>
          <p style={{ color: '#94a3b8', marginTop: '20px' }}>
            Use the navigation bar above to manage your Categories, Incomes, and Expenses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-container">
      <h1 className="form-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
      <p className="form-subtitle">
        {isLogin ? 'Enter your details to access your account.' : 'Sign up to start tracking your money.'}
      </p>
      
      <form onSubmit={handleAuth}>
        {error && <div className="error-message">{error}</div>}
        
        <div className="input-group">
          <input
            id="username"
            type="text"
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder=" "
          />
          <label htmlFor="username" className="input-label">Username</label>
        </div>
        
        <div className="input-group">
          <input
            id="password"
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder=" "
          />
          <label htmlFor="password" className="input-label">Password</label>
        </div>
        
        <button type="submit" className="submit-btn">
          {isLogin ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
      
      <div className="toggle-mode">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <button type="button" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Sign up here' : 'Sign in here'}
        </button>
      </div>
    </div>
  );
}
