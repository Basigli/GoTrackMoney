'use client';

import { useState, useEffect, FormEvent } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useData, Income } from '@/hooks/useData';

export default function IncomesPage() {
  const { token, user, loading, logout } = useAuth();
  const { categories, incomes, fetchCategories, fetchIncomes } = useData(token);
  
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('');
  const [filter, setFilter] = useState('');

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchIncomes();
    }
  }, [token, fetchCategories, fetchIncomes]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8080/incomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name, description: desc, amount: parseFloat(amount), category_id: parseInt(cat, 10), received_on: new Date().toISOString()
        })
      });
      if (res.ok) {
        setName(''); setDesc(''); setAmount(''); setCat('');
        fetchIncomes();
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return null;
  if (!user) return null;

  const filteredIncomes = incomes.filter(i => 
    i.name.toLowerCase().includes(filter.toLowerCase()) || 
    i.description.toLowerCase().includes(filter.toLowerCase())
  );

  const groupedIncomes = filteredIncomes.reduce((acc, income) => {
    if (!acc[income.category_id]) acc[income.category_id] = [];
    acc[income.category_id].push(income);
    return acc;
  }, {} as Record<number, Income[]>);

  const modalIncomes = selectedCategory !== null ? groupedIncomes[selectedCategory] || [] : [];

  return (
    <div className="dashboard-container">
      <Navbar username={user.username} onLogout={logout} />
      
      <div className="card">
        <h2 className="card-title">Add Income</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input id="name" type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required placeholder=" " />
            <label htmlFor="name" className="input-label">Title</label>
          </div>
          <div className="form-row">
            <div className="input-group">
              <input id="amount" type="number" step="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder=" " />
              <label htmlFor="amount" className="input-label">Amount</label>
            </div>
            <div className="input-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
              <select id="cat" className="input-field" value={cat} onChange={(e) => setCat(e.target.value)} required>
                <option value="" disabled>Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <input id="desc" type="text" className="input-field" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder=" " />
            <label htmlFor="desc" className="input-label">Description (optional)</label>
          </div>
          <button type="submit" className="submit-btn" style={{ background: 'var(--success-color)' }}>Add Income</button>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Incomes by Category</h2>
        <div className="filters-bar">
          <input 
            type="text" 
            className="input-field filter-input" 
            placeholder="Search incomes..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="grid-layout">
          {Object.entries(groupedIncomes).map(([catId, incs]) => {
            const category = categories.find(c => c.id === parseInt(catId));
            const total = incs.reduce((sum, i) => sum + i.amount, 0);
            return (
              <div key={catId} className="card group-card" onClick={() => setSelectedCategory(parseInt(catId))}>
                <div className="group-header">
                  <h3 style={{ margin: 0, color: 'white' }}>{category?.name || 'Unknown'}</h3>
                  <div className="amount income">+${total.toFixed(2)}</div>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>{incs.length} transactions</div>
              </div>
            );
          })}
        </div>
        {Object.keys(groupedIncomes).length === 0 && <div style={{color: '#94a3b8', textAlign: 'center'}}>No incomes found.</div>}
      </div>

      {selectedCategory !== null && (
        <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedCategory(null)}>&times;</button>
            <h2 className="card-title" style={{ marginBottom: '24px' }}>
              {categories.find(c => c.id === selectedCategory)?.name} Incomes
            </h2>
            <div>
              {modalIncomes.map(i => (
                <div key={i.id} className="list-item">
                  <div>
                    <div className="list-item-title">{i.name}</div>
                    <div className="list-item-subtitle">{i.description || 'No description'}</div>
                  </div>
                  <div className="amount income">+${i.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
