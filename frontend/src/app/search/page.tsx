'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionSearch } from '@/hooks/useTransactionSearch';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Transaction } from '@/utils/transactions';
import AppShell from '@/components/AppShell';
import styles from './Search.module.css';
import TransactionEditor from '@/components/TransactionEditor';

function SearchContent() {
  const { user, token, loading } = useAuth();
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const query = params.toString();
  const { result, categories, ready, failed, retry } = useTransactionSearch(token, query);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const advancedFilterCount = ['type', 'category_id', 'from', 'to', 'min_amount', 'max_amount'].filter(field => Boolean(params.get(field))).length;
  const change = (field: string, value: string) => {
    const next = new URLSearchParams(query);
    if (value) next.set(field, value); else next.delete(field);
    if (field !== 'offset') next.delete('offset');
    window.history.replaceState(null, '', '/search?' + next.toString());
  };
  if (loading || !user || !token) return null;
  const money = (amount: number) => new Intl.NumberFormat(language, { style:'currency', currency:'EUR' }).format(amount);
  return <AppShell>
    <main className="page-content">
      <h1>{t('nav.search')}</h1>
      <p className="analytics-note">{t('search.history')}</p>
      <div className={styles.primary}>
        <label>{t('dashboard.search')}<input className="input-field" type="search" value={params.get('q') || ''} onChange={e => change('q', e.target.value)} /></label>
        <button type="button" className={`secondary-btn ${styles.filterToggle}`} aria-expanded={showMobileFilters} aria-controls="search-advanced-filters" onClick={() => setShowMobileFilters(open => !open)}>
          {t(showMobileFilters ? 'search.hide_filters' : 'search.show_filters')}{advancedFilterCount > 0 && <span className={styles.filterCount}>{advancedFilterCount}</span>}
        </button>
      </div>
      <div id="search-advanced-filters" className={`${styles.advanced} ${showMobileFilters ? styles.open : ''}`}>
        <div className={styles.filters}>
          <label>{t('record.type')}<select className="input-field" value={params.get('type') || ''} onChange={e => { const next = new URLSearchParams(query); next.delete('category_id'); next.delete('offset'); if (e.target.value) next.set('type', e.target.value); else next.delete('type'); window.history.replaceState(null, '', '/search?' + next); }}>
            <option value="">{t('search.all')}</option><option value="expense">{t('record.expense')}</option><option value="income">{t('record.income')}</option>
          </select></label>
          <label>{t('record.category')}<select className="input-field" value={params.get('category_id') || ''} onChange={e => change('category_id', e.target.value)}>
            <option value="">{t('search.all')}</option>
            {categories.filter(c => !params.get('type') || c.type === params.get('type')).sort((a,b) => a.name.localeCompare(b.name, language, { sensitivity:'base' })).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select></label>
          {(['from','to','min_amount','max_amount'] as const).map(field => <label key={field}>{t('search.' + field)}
            <input className="input-field" type={field === 'from' || field === 'to' ? 'date' : 'number'} min={field === 'from' || field === 'to' ? undefined : '0'} step={field === 'from' || field === 'to' ? undefined : '0.01'} value={params.get(field) || ''} onChange={e => change(field, e.target.value)} />
          </label>)}
        </div>
        <button type="button" className="secondary-btn" onClick={() => window.history.replaceState(null, '', '/search')}>{t('search.clear')}</button>
      </div>
      {!ready && <p role={failed ? 'alert' : 'status'}>{t(failed ? 'search.error' : 'analytics.loading')}
        {failed && <button className="secondary-btn" onClick={retry}>{t('analytics.retry')}</button>}
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
    {editing && <TransactionEditor token={token} categories={categories} item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); change('offset', '0'); retry(); }} />}
  </AppShell>;
}
export default function SearchPage() { return <Suspense fallback={null}><SearchContent /></Suspense>; }
