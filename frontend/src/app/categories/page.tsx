'use client';

import { useState, useEffect, FormEvent } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';

export default function CategoriesPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, fetchCategories } = useData(token);
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (token) fetchCategories();
  }, [token, fetchCategories]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8080/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setName('');
        fetchCategories();
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return null;
  if (!user) return null;

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="dashboard-container">
      <Navbar username={user.username} onLogout={logout} />
      
      <div className="card">
        <h2 className="card-title">New Category</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input id="name" type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required placeholder=" " />
            <label htmlFor="name" className="input-label">Category Name</label>
          </div>
          <button type="submit" className="submit-btn">Add Category</button>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">My Categories</h2>
        <div className="filters-bar">
          <input 
            type="text" 
            className="input-field filter-input" 
            placeholder="Filter categories..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div>
          {filteredCategories.map(c => (
            <div key={c.id} className="list-item">
              <div className="list-item-title">{c.name}</div>
            </div>
          ))}
          {filteredCategories.length === 0 && <div style={{color: '#94a3b8', textAlign: 'center'}}>No categories found.</div>}
        </div>
      </div>
    </div>
  );
}
