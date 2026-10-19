'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DuplicateExpenseReview } from '@/utils/expenseDuplicates';
import styles from './ExpenseDuplicateReview.module.css';

export default function ExpenseDuplicateReview({ review, busy, failure, onBack, onConfirm }: {
  review: DuplicateExpenseReview; busy: boolean; failure: string;
  onBack: () => void; onConfirm: () => void;
}) {
  const { t, language } = useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });
  const money = new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' });

  return <section aria-labelledby="duplicate-review-heading">
    <h3 id="duplicate-review-heading" ref={heading} tabIndex={-1}>{t('duplicate.title')}</h3>
    <p className={styles.explanation}>{t('duplicate.explanation')}</p>
    <ul className={styles.matches}>
      {review.matches.map(match => <li key={match.id} className={styles.match}>
        <div className={styles.header}>
          <strong>{match.description || match.name}</strong>
          <strong className={styles.amount}>{money.format(match.amount)}</strong>
        </div>
        <p><span aria-hidden="true">{match.category_emoji} </span>{match.category_name}</p>
        <p>{date.format(new Date(match.spent_on))}</p>
        {match.is_periodic && <span className={styles.badge}>{t('record.periodic')}</span>}
      </li>)}
    </ul>
    {review.total > review.matches.length && <p className={styles.explanation}>{t('duplicate.more', {
      shown: String(review.matches.length), total: String(review.total),
    })}</p>}
    {failure && <p role="alert" className="field-error">{failure}</p>}
    <div className={styles.actions}>
      <button type="button" className="secondary-btn" disabled={busy} onClick={onBack}>{t('duplicate.back')}</button>
      <button type="button" className="submit-btn" disabled={busy} onClick={onConfirm}>{t(busy ? 'form.saving' : 'duplicate.save_anyway')}</button>
    </div>
  </section>;
}
