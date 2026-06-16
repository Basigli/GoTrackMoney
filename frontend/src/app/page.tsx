'use client';

import { useState, useEffect, FormEvent } from 'react';

const API_BASE = 'http://localhost:8080';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState<{id: number, username: string} | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken);
    }
  }, []);

  const fetchMe = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        logout();
      }
    } catch (e) {
      console.error(e);
      logout();
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
    } catch (err: any) {
      setError(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  if (token && user) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-title">Welcome, {user.username}</div>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
        <div className="card">
          <p style={{ color: '#94a3b8' }}>Your financial dashboard is ready.</p>
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
