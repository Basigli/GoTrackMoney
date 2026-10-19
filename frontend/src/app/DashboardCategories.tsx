import type { Category, Income, Expense } from '@/types/domain';
import { useLanguage } from '@/i18n/LanguageContext';
import { categoryColor } from '@/utils/categoryColors';
import styles from './Dashboard.module.css';
import Money from '@/components/Money';
import Link from 'next/link';

export type DashboardTab = 'uscite' | 'entrate';

export default function DashboardCategories({ tab, onTabChange, groups, categories, total, onSelect, onAdd }: {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  groups: Record<number, (Income | Expense)[]>;
  categories: Category[];
  total: number;
  onSelect: (id: number) => void;
  onAdd: () => void;
}) {
  const { t, language } = useLanguage();
  const rows = Object.entries(groups).map(([categoryId, items]) => {
    const id = Number(categoryId);
    return { id, category: categories.find(item => item.id === id), amount: items.reduce((sum, item) => sum + item.amount, 0) };
  }).sort((a, b) => b.amount - a.amount || (a.category?.name || '').localeCompare(b.category?.name || '', language) || a.id - b.id);
  return <>
    <div className={styles.tabs}>
      <button type="button" className={`${styles.tab} ${tab === 'uscite' ? styles.tabActive : ''}`} aria-pressed={tab === 'uscite'} onClick={() => onTabChange('uscite')}>{t('dashboard.expenses')}</button>
      <button type="button" className={`${styles.tab} ${tab === 'entrate' ? styles.tabActive : ''}`} aria-pressed={tab === 'entrate'} onClick={() => onTabChange('entrate')}>{t('dashboard.incomes')}</button>
    </div>
    {rows.length === 0 && <section className={styles.emptyState}>
      <h2>{t(tab === 'uscite' ? 'dashboard.empty_expenses' : 'dashboard.empty_incomes')}</h2>
      {categories.some(category => category.type === (tab === 'uscite' ? 'expense' : 'income')) ? <>
        <p>{t('dashboard.empty_hint')}</p>
        <button type="button" className="submit-btn" onClick={onAdd}>{t(tab === 'uscite' ? 'form.add_expense' : 'form.add_income')}</button>
      </> : <>
        <p>{t('dashboard.create_category_hint')}</p>
        <Link className={`secondary-btn ${styles.emptyAction}`} href={`/categories?new=${tab === 'uscite' ? 'expense' : 'income'}`}>{t('categories.new')}</Link>
      </>}
    </section>}
    <div className="list-container">
      {rows.map(({ id, category, amount }) => {
        const percentage = total > 0 ? amount / total * 100 : 0;
        return <button type="button" key={id} className={`list-item ${styles.categoryRow}`} onClick={() => onSelect(id)}>
          <span className={styles.itemIcon}>{category?.emoji || '📝'}</span>
          <span className={styles.itemContent}>
            <span className={styles.itemHeader}>
              <span className={styles.itemTitle}>{category?.name || t('dashboard.unknown')}</span>
              <span className={styles.itemAmount}><Money amount={amount} /></span>
            </span>
            <span className={styles.progressContainer}>
              <span className={styles.progressTrack}><span className={styles.progressFill} style={{ width: `${percentage}%`, backgroundColor: categoryColor({ id, color: category?.color }) }} /></span>
              <span className={styles.progressText}>{percentage.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {t('dashboard.percentage_total')}</span>
            </span>
          </span>
        </button>;
      })}
    </div>
  </>;
}
