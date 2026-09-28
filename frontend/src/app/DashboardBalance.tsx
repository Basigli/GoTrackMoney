import { useLanguage } from '@/i18n/LanguageContext';
import styles from './Dashboard.module.css';

export default function DashboardBalance({ income, expense }: { income: number; expense: number }) {
  const { t } = useLanguage();
  return <div className={styles.balanceBanner}>
    <p className={styles.balanceTitle}>{t('dashboard.total_balance')}</p>
    <h1 className={styles.balanceAmount}>{(income - expense).toFixed(2)} €</h1>
    <div className={styles.balanceStats}>
      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.expense}`}>↓</div>
        <div className={styles.statDetails}><p>{t('dashboard.expenses')}</p><h4>{expense.toFixed(2)} €</h4></div>
      </div>
      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.income}`}>↑</div>
        <div className={styles.statDetails}><p>{t('dashboard.incomes')}</p><h4>{income.toFixed(2)} €</h4></div>
      </div>
    </div>
  </div>;
}
