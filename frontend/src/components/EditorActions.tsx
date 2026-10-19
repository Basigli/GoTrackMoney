import { useLanguage } from '@/i18n/LanguageContext';
import styles from './EditorActions.module.css';

export default function EditorActions({ onCancel, onDelete, busy, submitLabel }: {
  onCancel: () => void; onDelete?: () => void; busy: boolean; submitLabel: string;
}) {
  const { t } = useLanguage();
  return <div className={styles.footer}>
    <div className={styles.actions}>
      <button type="button" className="secondary-btn" disabled={busy} onClick={onCancel}>{t('auth.cancel')}</button>
      <button type="submit" className="submit-btn" disabled={busy}>{submitLabel}</button>
    </div>
    {onDelete && <button type="button" className={`secondary-btn danger ${styles.deleteButton}`} disabled={busy} onClick={onDelete}>{t('form.delete')}</button>}
  </div>;
}
