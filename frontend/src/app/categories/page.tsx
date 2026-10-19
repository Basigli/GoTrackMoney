'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import CategorySection from './CategorySection';
import CategoryEditor from './CategoryEditor';
import styles from './Categories.module.css';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import type { Category } from '@/types/domain';
import { useLanguage } from '@/i18n/LanguageContext';

function CategoriesContent() {
  const { token, user, loading } = useAuth();
  const { categories, ready, failed, fetchCategories } = useCategories(token);
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const requestedType = params.get('new');
  const [editor, setEditor] = useState<{ category?: Category; type: Category['type'] } | null>(() =>
    requestedType === 'expense' || requestedType === 'income' ? { type: requestedType } : null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (token) void fetchCategories().catch(() => {});
  }, [token, fetchCategories]);

  const closeEditor = () => {
    setEditor(null);
    if (params.has('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      window.history.replaceState(null, '', '/categories' + (next.size ? '?' + next : ''));
    }
  };
  if (loading || !user || !token) return null;
  const filtered = categories.filter(category => category.name.toLocaleLowerCase(language).includes(filter.trim().toLocaleLowerCase(language)))
    .sort((a, b) => a.name.localeCompare(b.name, language, { sensitivity: 'base' }));
  return <AppShell>
    <main className={styles.listSection}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('categories.my_categories')}</h1>
        <button type="button" className={`submit-btn ${styles.newButton}`} onClick={() => setEditor({ type: 'expense' })}>{t('categories.new')}</button>
      </div>
      <div className={styles.searchWrap}>
        <input type="search" aria-label={t('categories.search')} placeholder={t('categories.search')} value={filter} onChange={event => setFilter(event.target.value)} className={styles.searchInput} />
      </div>
      {failed && <p role="alert">{t('analytics.load_error')} <button type="button" className="secondary-btn" onClick={() => { void fetchCategories().catch(() => {}); }}>{t('analytics.retry')}</button></p>}
      {!ready && !failed && <p role="status">{t('analytics.loading')}</p>}
      {ready && <div className={styles.groups}>
        {(['expense', 'income'] as const).map(kind => <CategorySection key={kind}
          title={t(kind === 'expense' ? 'categories.expenses_list' : 'categories.incomes_list')} kind={kind}
          categories={filtered.filter(category => category.type === kind)}
          emptyText={t(filter.trim() ? 'categories.no_matches' : 'categories.no_categories')}
          onEdit={category => setEditor({ category, type: category.type })} />)}
      </div>}
    </main>
    {editor && <CategoryEditor key={editor.category?.id ?? editor.type} token={token} category={editor.category} initialType={editor.type}
      onClose={closeEditor} onSaved={() => { closeEditor(); void fetchCategories().catch(() => {}); }} />}
  </AppShell>;
}

export default function CategoriesPage() {
  return <Suspense fallback={null}><CategoriesContent /></Suspense>;
}
