'use client';

import { useState, useEffect, FormEvent } from 'react';
import AppShell from '@/components/AppShell';
import CategorySection from './CategorySection';
import styles from './Categories.module.css';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import type { Category } from '@/types/domain';
import toast from 'react-hot-toast';
import { apiRequest } from '@/utils/api';
import { CATEGORY_COLORS, categoryColor } from '@/utils/categoryColors';
import { useLanguage } from '@/i18n/LanguageContext';

export default function CategoriesPage() {
  const { token, user, loading } = useAuth();
  const { categories, ready: categoriesReady, failed: categoriesFailed, fetchCategories } = useCategories(token);
  const { t } = useLanguage();
  
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [filter, setFilter] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (token) void fetchCategories().catch(() => {});
  }, [token, fetchCategories]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    const endpoint = editingCategory ? `/categories/${editingCategory.id}` : '/categories';
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      await apiRequest<Category>(endpoint, { method, token, body: { name, emoji, type, color } });
      setName('');
      setEmoji('📝');
      setColor(CATEGORY_COLORS[(categories.length + 1) % CATEGORY_COLORS.length]);
      setEditingCategory(null);
      toast.success(editingCategory ? t('categories.success_update') : t('categories.success_create'));
      void fetchCategories().catch(() => {});
    } catch {
      toast.error(t('categories.error_save'));
    }
  };

  const handleEditClick = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setEmoji(cat.emoji || '📝');
    setType(cat.type || 'expense');
    setColor(categoryColor(cat));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return null;
  if (!user) return null;

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
  const incomeCategories = filteredCategories.filter(c => c.type === 'income');
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense');

  return (
    <AppShell>
      
      <div className={styles.section}>
        <h2 className={styles.title}>
          {editingCategory ? t('categories.edit') : t('categories.new')}
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          
          <div className={styles.fields}>
            <div>
              <label className={styles.label} htmlFor="category-emoji">{t('categories.emoji')}</label>
              <input id="category-emoji" type="text" value={emoji} onChange={e => setEmoji(e.target.value)} className={styles.emojiInput} required />
            </div>
            <div>
              <label className={styles.label} htmlFor="category-name">{t('categories.name')}</label>
              <input id="category-name" type="text" value={name} onChange={e => setName(e.target.value)} className={styles.nameInput} placeholder={t('categories.name_placeholder')} required />
            </div>
            <div>
              <label className={styles.label} htmlFor="category-color">Colore</label>
              <div className={styles.colorInputWrap}>
                <input id="category-color" type="color" value={color} onChange={e => setColor(e.target.value)} className={styles.colorInput} />
              </div>
            </div>
          </div>

          <div className={styles.typeOptions}>
            <label className={styles.typeOption}>
              <input type="radio" name="catType" checked={type === 'expense'} onChange={() => setType('expense')} />
              {t('categories.type_expense')}
            </label>
            <label className={styles.typeOption}>
              <input type="radio" name="catType" checked={type === 'income'} onChange={() => setType('income')} />
              {t('categories.type_income')}
            </label>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={`submit-btn ${styles.saveButton}`}>
              {editingCategory ? t('categories.save_btn') : t('categories.add_btn')}
            </button>
            {editingCategory && (
              <button type="button" onClick={() => { setEditingCategory(null); setName(''); setEmoji('📝'); setColor(CATEGORY_COLORS[0]); }} className={styles.cancelButton}>
                {t('categories.cancel_btn')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className={styles.listSection}>
        <h2 className={styles.title}>{t('categories.my_categories')}</h2>
        
        <div className={styles.searchWrap}>
          <input 
            type="text" 
            aria-label={t('categories.search')}
            placeholder={t('categories.search')}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {categoriesFailed && <p role="alert">{t('analytics.load_error')} <button type="button" className="secondary-btn" onClick={() => { void fetchCategories().catch(() => {}); }}>{t('analytics.retry')}</button></p>}
        {!categoriesReady && !categoriesFailed && <p role="status">{t('analytics.loading')}</p>}
        {categoriesReady && <div className={styles.groups}>
          <CategorySection title={t('categories.expenses_list')} kind="expense" categories={expenseCategories} emptyText={t('categories.no_categories')} onEdit={handleEditClick} />
          <CategorySection title={t('categories.incomes_list')} kind="income" categories={incomeCategories} emptyText={t('categories.no_categories')} onEdit={handleEditClick} />
        </div>}

      </div>
    </AppShell>
  );
}
