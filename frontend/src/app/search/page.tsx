'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import type { Category } from '@/hooks/useData';
import { useLanguage } from '@/i18n/LanguageContext';
import { API_BASE } from '@/utils/api';
import type { Transaction } from '@/utils/transactions';
import Navbar from '@/components/Navbar';
import TransactionEditor from '@/components/TransactionEditor';

interface Results { items: Transaction[]; total: number; limit: number; offset: number }
function SearchContent() {
  const { user, token, loading, logout } = useAuth();
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const query = params.toString();
  const [categories, setCategories] = useState<Category[]>([]);
  const [snapshot, setSnapshot] = useState<{ key: string; result: Results } | null>(null);
  const [failure, setFailure] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const key = token + ':' + query + ':' + revision;
  const ready = snapshot?.key === key;
  const failed = failure === key;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const headers = { Authorization: 'Bearer ' + token };
      Promise.all([
        fetch(API_BASE + '/transactions/search?' + query, { headers, signal: controller.signal }).then(res => { if (!res.ok) throw new Error(); return res.json() as Promise<Results>; }),
        fetch(API_BASE + '/categories', { headers, signal: controller.signal }).then(res => { if (!res.ok) throw new Error(); return res.json() as Promise<Category[]>; }),
      ]).then(([result, list]) => {
        if (controller.signal.aborted) return;
        setSnapshot({ key, result }); setCategories(list || []);
      }).catch(() => { if (!controller.signal.aborted) setFailure(key); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [token, query, key]);
  const change = (field: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(field, value); else next.delete(field);
    if (field !== 'offset') next.delete('offset');
    window.history.replaceState(null, '', '/search?' + next.toString());
  };
  if (loading || !user || !token) return null;
  const result = ready ? snapshot.result : null;
  const money = (amount: number) => new Intl.NumberFormat(language, { style:'currency', currency:'EUR' }).format(amount);
  return <div className="app-container">
    <Navbar username={user.username} onLogout={logout} isAdmin={user.is_admin} />
    <main className="page-content">
      <h1>{t('nav.search')}</h1>
      <p className="analytics-note">{t('search.history')}</p>
      <div className="search-filters">
        <label>{t('dashboard.search')}<input className="input-field" type="search" value={params.get('q') || ''} onChange={e => change('q', e.target.value)} /></label>
        <label>{t('record.type')}<select className="input-field" value={params.get('type') || ''} onChange={e => { const next = new URLSearchParams(query); next.delete('category_id'); next.delete('offset'); if (e.target.value) next.set('type', e.target.value); else next.delete('type'); window.history.replaceState(null, '', '/search?' + next); }}>
          <option value="">{t('search.all')}</option><option value="expense">{t('record.expense')}</option><option value="income">{t('record.income')}</option>
        </select></label>
        <label>{t('record.category')}<select className="input-field" value={params.get('category_id') || ''} onChange={e => change('category_id', e.target.value)}>
          <option value="">{t('search.all')}</option>
          {categories.filter(c => !params.get('type') || c.type === params.get('type')).sort((a,b) => a.name.localeCompare(b.name, language, { sensitivity:'base' })).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select></label>
        {(['from','to','min_amount','max_amount'] as const).map(field => <label key={field}>{t('search.' + field)}
          <input className="input-field" type={field === 'from' || field === 'to' ? 'date' : 'number'} min="0" step="0.01" value={params.get(field) || ''} onChange={e => change(field, e.target.value)} />
        </label>)}
      </div>
      <button className="secondary-btn" onClick={() => window.history.replaceState(null, '', '/search')}>{t('search.clear')}</button>
      {!ready && <p role={failed ? 'alert' : 'status'}>{t(failed ? 'search.error' : 'analytics.loading')}
        {failed && <button className="secondary-btn" onClick={() => setRevision(n => n + 1)}>{t('analytics.retry')}</button>}
      </p>}
      {result && <>
        <p aria-live="polite">{t('search.results_count', { count: String(result.total) })}</p>
        <div className="list-container">{result.items.map(item => <button className="list-item transaction-row" key={item.type + ':' + item.id} onClick={() => setEditing(item)}>
          <span><strong>{item.description || item.name}</strong><small>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')} · {categories.find(c => c.id === item.category_id)?.name || t('dashboard.unknown')}{item.is_periodic && ' · ' + t('record.periodic')}</small></span>
          <span className={item.type === 'expense' ? 'amount-expense' : 'amount-income'}>{item.type === 'expense' ? '−' : '+'}{money(item.amount)}</span>
        </button>)}</div>
        {result.total === 0 && <p>{t('search.empty')}</p>}
        <div className="form-row">
          <button className="secondary-btn" disabled={result.offset === 0} onClick={() => change('offset', String(Math.max(0, result.offset - result.limit)))}>{t('search.previous')}</button>
          <span>{result.total ? result.offset + 1 : 0}–{Math.min(result.offset + result.items.length, result.total)} / {result.total}</span>
          <button className="secondary-btn" disabled={result.offset + result.limit >= result.total} onClick={() => change('offset', String(result.offset + result.limit))}>{t('search.next')}</button>
        </div>
      </>}
    </main>
    {editing && <TransactionEditor token={token} categories={categories} item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); change('offset', '0'); setRevision(n => n+1); }} />}
  </div>;
}
export default function SearchPage() { return <Suspense fallback={null}><SearchContent /></Suspense>; }
