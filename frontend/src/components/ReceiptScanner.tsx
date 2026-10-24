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
  const [failure, setFailure] = useState('');
  const [lowQuality, setLowQuality] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imageUrl = useRef('');
  const controller = useRef<AbortController | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const review = useRef<HTMLDivElement>(null);
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
      imageUrl.current = URL.createObjectURL(file);
      setPreview(imageUrl.current);
      setText(result.text);
      setLowQuality(result.confidence < 70);
      setDetails(extractReceipt(result.text));
      onReviewReady();
      requestAnimationFrame(() => review.current?.querySelector<HTMLInputElement>('input')?.focus());
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
  const stop = () => { controller.current?.abort(); controller.current = null; setProgress(null); };
  const change = (field: 'merchant' | 'amount' | 'date' | 'time', value: string) => {
    setDetails(old => old ? { ...old, [field]: value } : old);
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

  return <section className={styles.scanner} aria-label={t('receipt.title')}>
    <p className={styles.note}>{t('receipt.privacy')}</p>
    {!details && <p className={styles.note}>{t('receipt.photo_hint')}</p>}
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className={styles.fileInput} aria-label={t('receipt.choose_image')}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void read(file); }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" className={styles.fileInput} aria-label={t('receipt.take_photo')}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void read(file); }} />
    <div className={styles.actions}>
      <button ref={firstAction} type="button" className="secondary-btn" disabled={!!progress} onClick={() => camera.current?.click()}>{t('receipt.take_photo')}</button>
      <button type="button" className="secondary-btn" disabled={!!progress} onClick={() => gallery.current?.click()}>{t(details ? 'receipt.another_image' : 'receipt.choose_image')}</button>
    </div>
    {progress && <div className={styles.progress} role="status">
      <p>{t(`receipt.${progress.stage}`)}</p>
      <progress max="1" value={progress.stage === 'recognizing' ? progress.progress : undefined} aria-label={t('receipt.progress')} />
      <button type="button" className="secondary-btn" onClick={stop}>{t('receipt.stop')}</button>
    </div>}
    {failure && <p role="alert" className="field-error">{failure}</p>}
    {details && <div ref={review} className={styles.review}>
      <p className={styles.reviewNote}>{t('receipt.review')}</p>
      {(details.issues.length > 0 || lowQuality) && <ul className={styles.issues}>
        {lowQuality && <li>{t('receipt.low_quality')}</li>}
        {details.issues.map(issue => <li key={issue}>{t(`receipt.${issue}`)}</li>)}
      </ul>}
      {preview && <div className={styles.preview}><Image src={preview} alt={t('receipt.preview')} width={600} height={800} unoptimized /></div>}
      <label htmlFor="receipt-merchant">{t('receipt.merchant')}</label>
      <input id="receipt-merchant" className="input-field" value={details.merchant} onChange={event => change('merchant', event.target.value)} maxLength={200} />
      <label htmlFor="receipt-amount">{t('record.amount')} (EUR)</label>
      <input id="receipt-amount" className="input-field" inputMode="decimal" value={details.amount} onChange={event => change('amount', event.target.value)} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'receipt-amount-error' : undefined} />
      {errors.amount && <p id="receipt-amount-error" className="field-error">{errors.amount}</p>}
      <div className={styles.dateFields}>
        <div><label htmlFor="receipt-date">{t('record.date')}</label><input id="receipt-date" className="input-field" type="date" value={details.date} onChange={event => change('date', event.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'receipt-date-error' : undefined} /></div>
        <div><label htmlFor="receipt-time">{t('receipt.time')}</label><input id="receipt-time" className="input-field" type="time" value={details.time} onChange={event => change('time', event.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'receipt-date-error' : undefined} /></div>
      </div>
      {errors.date && <p id="receipt-date-error" className="field-error">{errors.date}</p>}
      <details className={styles.recognized}><summary>{t('receipt.recognized_text')}</summary><pre>{text}</pre></details>
      <p className={styles.note}>{t('receipt.apply_hint')}</p>
    </div>}
    <div className={styles.footer}>
      <button type="button" className="secondary-btn" onClick={() => { stop(); onCancel(); }}>{t('receipt.back')}</button>
      {details && <button type="button" className="submit-btn" onClick={apply}>{t('receipt.apply')}</button>}
    </div>
  </section>;
}
