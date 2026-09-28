import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Category, Income, Expense } from '@/types/domain';
import { useLanguage } from '@/i18n/LanguageContext';
import SafeDialog from '@/components/SafeDialog';
import type { DashboardTab } from './DashboardCategories';
import styles from './Dashboard.module.css';

export default function DashboardCategoryDetails({ categoryId, categories, tab, items, locale, onClose, onAddExpense, onEdit }: {
  categoryId: number;
  categories: Category[];
  tab: DashboardTab;
  items: (Income | Expense)[];
  locale: Locale;
  onClose: () => void;
  onAddExpense: (categoryId: number) => void;
  onEdit: (item: Income | Expense) => void;
}) {
  const { t } = useLanguage();
  const category = categories.find(item => item.id === categoryId);
  return <SafeDialog title={t('dashboard.details_for', { category: category?.name || '' })} onClose={onClose}>
    {tab === 'uscite' && <button type="button" className="submit-btn" onClick={() => onAddExpense(categoryId)}>{t('form.add_expense')}</button>}
    <div className={styles.detailsList}>
      {items.map(item => <button type="button" key={item.id} className={`list-item ${styles.detailRow}`} onClick={() => onEdit(item)}>
        <span className={styles.itemContent}>
          <span className={`${styles.itemHeader} ${styles.detailHeader}`}>
            <span className={`${styles.itemTitle} ${styles.detailTitle}`}>
              <span>{item.description || item.name}</span>
              {'is_periodic' in item && item.is_periodic && <span className={styles.periodicBadge}>{t('record.periodic')}</span>}
            </span>
            <span className={`${styles.itemAmount} ${tab === 'uscite' ? styles.expenseAmount : styles.incomeAmount}`}>
              {tab === 'uscite' ? '-' : '+'}{item.amount.toFixed(2)} €
            </span>
          </span>
          <span className={styles.detailDate}>{format(new Date('spent_on' in item ? item.spent_on : item.received_on), 'd MMM yyyy, HH:mm', { locale })}</span>
        </span>
      </button>)}
    </div>
  </SafeDialog>;
}
