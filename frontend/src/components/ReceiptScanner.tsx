'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/i18n/LanguageContext';
import { extractReceipt, type ReceiptDetails } from '@/utils/receipts';
import { recognizeReceipt, ReceiptImageError, type ReceiptProgress } from '@/utils/receiptOcr';
import styles from './ReceiptScanner.module.css';

export default function ReceiptScanner({ onApply, onCancel, onReviewReady }: { onApply: (details: ReceiptDetails) => void; onCancel: () => void; onReviewReady: () => void }) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<ReceiptProgress | null>(null);
  const [details, setDetails] = useState<ReceiptDetails | null>(null);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState('');
  const [photoOpen, setPhotoOpen] = useState(() => window.matchMedia('(min-width: 700px)').matches);
  const [failure, setFailure] = useState('');
  const [lowQuality, setLowQuality] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imageUrl = useRef('');
  const controller = useRef<AbortController | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const review = useRef<HTMLDivElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const firstAction = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstAction.current?.focus();
    return () => {
      controller.current?.abort();
      controller.current = null;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    };
  }, []);

  const read = async (file?: File) => {
    if (!file) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setDetails(null); setFailure(''); setErrors({}); setText(''); setLowQuality(false);
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = ''; setPreview('');
    setProgress({ stage: 'preparing', progress: 0 });
    let rejectAborted = () => {};
    const aborted = new Promise<never>((_, reject) => { rejectAborted = () => reject(request.signal.reason); });
    request.signal.addEventListener('abort', rejectAborted, { once: true });
    const timeout = window.setTimeout(() => request.abort(new DOMException('OCR timeout', 'TimeoutError')), 120000);
    try {
      const recognition = recognizeReceipt(file, request.signal, update => {
        if (!request.signal.aborted) setProgress(update);
      });
      const result = await Promise.race([recognition, aborted]);
      if (request.signal.aborted) return;
      if (!result.text.trim()) throw new Error('empty');
      imageUrl.current = URL.createObjectURL(result.image);
      setPreview(imageUrl.current);
      setText(result.text);
      setLowQuality(result.confidence < 70);
      setDetails(extractReceipt(result.text));
      onReviewReady();
      requestAnimationFrame(() => {
        content.current?.scrollTo({ top: 0 });
        reviewHeading.current?.focus({ preventScroll: true });
      });
    } catch (error) {
      if (controller.current !== request) return;
      if (request.signal.aborted && request.signal.reason?.name !== 'TimeoutError') return;
      const message = t(error instanceof ReceiptImageError ? `receipt.${error.reason}`
        : request.signal.reason?.name === 'TimeoutError' ? 'receipt.timeout'
        : error instanceof Error && error.message === 'empty' ? 'receipt.empty' : 'receipt.error');
      request.abort();
      setFailure(message);
    } finally {
      window.clearTimeout(timeout);
      request.signal.removeEventListener('abort', rejectAborted);
      if (controller.current === request) setProgress(null);
    }
  };
  const stop = () => {
    controller.current?.abort(); controller.current = null; setProgress(null);
    requestAnimationFrame(() => firstAction.current?.focus());
  };
  const change = (field: 'merchant' | 'amount' | 'date' | 'time', value: string) => {
    setDetails(old => old ? { ...old, [field]: value, issues: old.issues.filter(issue => !issue.startsWith(`${field}_`) && !(field === 'amount' && issue === 'currency_unsupported')) } : old);
    setErrors(old => { const next = { ...old }; delete next[field === 'time' ? 'date' : field]; return next; });
  };
  const apply = () => {
    if (!details) return;
    const invalid: Record<string, string> = {};
    const amount = Number(details.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) invalid.amount = t('form.amount_error');
    const dateTime = `${details.date}T${details.time}`;
    const date = new Date(dateTime);
    // Compare local parts too, so invalid dates and DST gaps cannot roll forward.
    if (!Number.isFinite(date.getTime()) || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` !== dateTime) invalid.date = t('receipt.date_required');
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => review.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onApply({ ...details, amount: String(amount) });
  };

  const hints = (field: 'merchant' | 'amount' | 'date' | 'time') => details?.issues
    .filter(issue => issue.startsWith(`${field}_`) || (field === 'amount' && issue === 'currency_unsupported'))
    .map(issue => t(`receipt.${issue}`)).join(' ');
  const description = (field: 'merchant' | 'amount' | 'date' | 'time') => [
    hints(field) && `receipt-${field}-hint`,
    errors[field === 'time' ? 'date' : field] && `receipt-${field === 'time' ? 'date' : field}-error`,
  ].filter(Boolean).join(' ') || undefined;

  return <section className={styles.scanner} aria-label={t('receipt.title')}>
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className={styles.fileInput} aria-label={t('receipt.choose_image')}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void read(file); }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" className={styles.fileInput} aria-label={t('receipt.take_photo')}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void read(file); }} />
    <div ref={content} className={styles.content}>
      {!details && !progress && <>
        <p className={styles.intro}>{t('receipt.photo_hint')}</p>
        <div className={styles.actions}>
          <button type="button" className={`secondary-btn ${styles.cameraAction}`} onClick={() => camera.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 5l2-2h4l2 2h4v15H4V5h4Z"/><circle cx="12" cy="12" r="4"/></svg>
            <span><strong>{t('receipt.take_photo')}</strong><small aria-hidden="true">{t('receipt.camera_hint')}</small></span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
          <button ref={firstAction} type="button" className="secondary-btn" onClick={() => gallery.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>
            <span><strong>{t('receipt.choose_image')}</strong><small aria-hidden="true">{t('receipt.gallery_hint')}</small></span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
        </div>
        <p className={styles.note}>{t('receipt.formats')}</p>
      </>}
      {progress && <div className={styles.progress} role="status">
        <span className={styles.readingIcon} aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6M9 15h3"/></svg></span>
        <p>{t(`receipt.${progress.stage}`)}</p>
        <progress max="1" value={progress.stage === 'recognizing' ? progress.progress : undefined} aria-label={t('receipt.progress')} />
        <button type="button" className="secondary-btn" onClick={stop}>{t('receipt.stop')}</button>
      </div>}
      {failure && <p role="alert" className="field-error">{failure}</p>}
      {details && <div ref={review} className={styles.review}>
        <div className={styles.reviewHeader}>
          <h3 ref={reviewHeading} tabIndex={-1}>{t('receipt.review_title')}</h3>
          <button type="button" className={`secondary-btn ${styles.replaceButton}`} onClick={() => gallery.current?.click()}>{t('receipt.another_image')}</button>
        </div>
        <p className={styles.reviewNote}>{t('receipt.review')}</p>
        {lowQuality && <p className={styles.notice}>{t('receipt.low_quality')}</p>}
        <div className={styles.reviewGrid}>
          {preview && <details className={styles.photo} open={photoOpen} onToggle={event => setPhotoOpen(event.currentTarget.open)}>
            <summary><Image src={preview} alt="" width={32} height={40} unoptimized /><span>{t('receipt.photo')}</span><span className={styles.chevron} aria-hidden="true">⌄</span></summary>
            <div className={styles.preview}><Image src={preview} alt={t('receipt.preview')} width={600} height={800} unoptimized /></div>
          </details>}
          <div className={styles.fields}>
            <label htmlFor="receipt-merchant">{t('receipt.merchant')}</label>
            <input id="receipt-merchant" className="input-field" value={details.merchant} onChange={event => change('merchant', event.target.value)} maxLength={200} aria-describedby={description('merchant')} />
            {hints('merchant') && <p id="receipt-merchant-hint" className={styles.hint}>{hints('merchant')}</p>}
            <label htmlFor="receipt-amount">{t('record.amount')} (EUR)</label>
            <input id="receipt-amount" className="input-field" inputMode="decimal" value={details.amount} onChange={event => change('amount', event.target.value)} aria-invalid={!!errors.amount} aria-describedby={description('amount')} />
            {hints('amount') && <p id="receipt-amount-hint" className={styles.hint}>{hints('amount')}</p>}
            {errors.amount && <p id="receipt-amount-error" className="field-error">{errors.amount}</p>}
            <div className={styles.dateFields}>
              <div><label htmlFor="receipt-date">{t('record.date')}</label><input id="receipt-date" className="input-field" type="date" value={details.date} onChange={event => change('date', event.target.value)} aria-invalid={!!errors.date} aria-describedby={description('date')} />
                {hints('date') && <p id="receipt-date-hint" className={styles.hint}>{hints('date')}</p>}
              </div>
              <div><label htmlFor="receipt-time">{t('receipt.time')}</label><input id="receipt-time" className="input-field" type="time" value={details.time} onChange={event => change('time', event.target.value)} aria-invalid={!!errors.date} aria-describedby={description('time')} />
                {hints('time') && <p id="receipt-time-hint" className={styles.hint}>{hints('time')}</p>}
              </div>
            </div>
            {errors.date && <p id="receipt-date-error" className="field-error">{errors.date}</p>}
          </div>
        </div>
        <details className={styles.recognized}><summary>{t('receipt.recognized_text')}</summary><pre>{text}</pre></details>
      </div>}
      {!details && <p className={styles.privacy}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></svg>
        {t('receipt.privacy')}
      </p>}
    </div>
    <div className={styles.footer}>
      <button type="button" className="secondary-btn" onClick={() => { stop(); onCancel(); }}>{t('receipt.back')}</button>
      {details && <button type="button" className="submit-btn" onClick={apply}>{t('receipt.apply')}</button>}
    </div>
  </section>;
}
