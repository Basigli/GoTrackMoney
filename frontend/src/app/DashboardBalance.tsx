import { useLanguage } from '@/i18n/LanguageContext';
import styles from './Dashboard.module.css';
import Money from '@/components/Money';

export default function DashboardBalance({ income, expense }: { income: number; expense: number }) {
  const { t } = useLanguage();
  return <section className={styles.balanceBanner}>
    <h2 className={styles.balanceTitle}>{t('dashboard.period_balance')}</h2>
    <p className={styles.balanceAmount}><Money amount={income - expense} /></p>
    <div className={styles.balanceStats}>
      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.expense}`}>↓</div>
        <div className={styles.statDetails}><p>{t('dashboard.expenses')}</p><strong><Money amount={expense} /></strong></div>
      </div>
      <div className={styles.statItem}>
        <div className={`${styles.statIcon} ${styles.income}`}>↑</div>
        <div className={styles.statDetails}><p>{t('dashboard.incomes')}</p><strong><Money amount={income} /></strong></div>
      </div>
    </div>
  </section>;
}
