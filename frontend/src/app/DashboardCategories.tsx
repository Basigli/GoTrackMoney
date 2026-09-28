import type { Category, Income, Expense } from '@/types/domain';
import { useLanguage } from '@/i18n/LanguageContext';
import { categoryColor } from '@/utils/categoryColors';
import styles from './Dashboard.module.css';

export type DashboardTab = 'uscite' | 'entrate';

export default function DashboardCategories({ tab, onTabChange, groups, categories, total, onSelect }: {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  groups: Record<number, (Income | Expense)[]>;
  categories: Category[];
  total: number;
  onSelect: (id: number) => void;
}) {
  const { t } = useLanguage();
  return <>
    <div className={styles.tabs}>
      <button type="button" className={`${styles.tab} ${tab === 'uscite' ? styles.tabActive : ''}`} aria-pressed={tab === 'uscite'} onClick={() => onTabChange('uscite')}>{t('dashboard.expenses')}</button>
      <button type="button" className={`${styles.tab} ${tab === 'entrate' ? styles.tabActive : ''}`} aria-pressed={tab === 'entrate'} onClick={() => onTabChange('entrate')}>{t('dashboard.incomes')}</button>
    </div>
    <div className="list-container">
      {Object.entries(groups).map(([categoryId, items]) => {
        const id = Number(categoryId);
        const category = categories.find(item => item.id === id);
        const amount = items.reduce((sum, item) => sum + item.amount, 0);
        const percentage = total > 0 ? amount / total * 100 : 0;
        return <button type="button" key={id} className={`list-item ${styles.categoryRow}`} onClick={() => onSelect(id)}>
          <span className={styles.itemIcon}>{category?.emoji || '📝'}</span>
          <span className={styles.itemContent}>
            <span className={styles.itemHeader}>
              <span className={styles.itemTitle}>{category?.name || t('dashboard.unknown')}</span>
              <span className={styles.itemAmount}>{amount.toFixed(2)} €</span>
            </span>
            <span className={styles.progressContainer}>
              <span className={styles.progressTrack}><span className={styles.progressFill} style={{ width: `${percentage}%`, backgroundColor: categoryColor({ id, color: category?.color }) }} /></span>
              <span className={styles.progressText}>{percentage.toFixed(2)} {t('dashboard.percentage_total')}</span>
            </span>
          </span>
        </button>;
      })}
    </div>
  </>;
}
