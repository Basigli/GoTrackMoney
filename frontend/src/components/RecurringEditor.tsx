'use client';
import { useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import type { Category, PeriodicExpense } from '@/hooks/useData';
import { useLanguage } from '@/i18n/LanguageContext';
import { API_BASE } from '@/utils/api';
import SafeDialog from './SafeDialog';

export default function RecurringEditor({ item, token, categories, onClose, onSaved }: {
  item: PeriodicExpense; token: string; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const { t, language } = useLanguage();
  const [initial] = useState(() => ({
    name: item.name, description: item.description, amount: String(item.amount), category_id: String(item.category_id),
    period_interval: String(item.period_interval), period_unit: item.period_unit,
    next_due_date: format(new Date(item.next_due_date), "yyyy-MM-dd'T'HH:mm"),
  }));
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [failure, setFailure] = useState('');
  const update = (field: keyof typeof form, value: string) => setForm(old => ({ ...old, [field]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const invalid: Record<string,string> = {};
    const amount = Number(form.amount.replace(',', '.'));
    const interval = Number(form.period_interval);
    if (!form.name.trim()) invalid.name = t('form.required');
    if (!Number.isFinite(amount) || amount <= 0) invalid.amount = t('form.amount_error');
    if (!Number.isInteger(interval) || interval < 1 || interval > 10000) invalid.period_interval = t('form.interval_error');
    if (!categories.some(c => c.id === Number(form.category_id) && c.type === 'expense')) invalid.category_id = t('form.category_error');
    const dateChanged = form.next_due_date !== initial.next_due_date;
    if (dateChanged && (!form.next_due_date || !Number.isFinite(new Date(form.next_due_date).getTime()) || new Date(form.next_due_date) <= new Date())) invalid.next_due_date = t('recurring.future_date');
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    submitting.current = true; setBusy(true); setFailure('');
    try {
      const res = await fetch(API_BASE + '/periodic-expenses/' + item.id, {
        method:'PUT', headers: { Authorization:'Bearer ' + token, 'Content-Type':'application/json' },
        body:JSON.stringify({
          name:form.name.trim(), description:form.description, amount, category_id:Number(form.category_id),
          period_interval:interval, period_unit:form.period_unit,
          ...(dateChanged ? { next_due_date: new Date(form.next_due_date).toISOString() } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch { setFailure(t('form.save_error')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <SafeDialog title={t('recurring.edit')} dirty={JSON.stringify(form) !== JSON.stringify(initial)} busy={busy} onClose={onClose}>
    <p className="analytics-note">{t('recurring.future_only')}</p>
    <form className="modal-form" onSubmit={save} noValidate><fieldset disabled={busy}>
      {(['name','amount','description','period_interval','next_due_date'] as const).map(field => <label key={field}>
        {t({ name:'recurring.name', amount:'record.amount', description:'record.description', period_interval:'recurring.interval', next_due_date:'recurring.next_due' }[field])}
        <input className="input-field" data-initial-focus={field === 'amount' ? true : undefined}
          type={field === 'next_due_date' ? 'datetime-local' : field === 'period_interval' ? 'number' : 'text'}
          inputMode={field === 'amount' ? 'decimal' : undefined} value={form[field]} aria-invalid={!!errors[field]} onChange={e => update(field, e.target.value)} />
        {errors[field] && <span className="field-error">{errors[field]}</span>}
      </label>)}
      <label>{t('record.category')}<select className="input-field" value={form.category_id} onChange={e => update('category_id', e.target.value)}>
        {categories.filter(c => c.type === 'expense').sort((a,b) => a.name.localeCompare(b.name, language, { sensitivity:'base' })).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
      </select></label>
      {errors.category_id && <p className="field-error">{errors.category_id}</p>}
      <label>{t('recurring.unit')}<select className="input-field" value={form.period_unit} onChange={e => update('period_unit', e.target.value)}>
        {['days','weeks','months','years'].map(unit => <option key={unit} value={unit}>{t('record.' + unit)}</option>)}
      </select></label>
      {failure && <p role="alert" className="field-error">{failure}</p>}
      <button className="submit-btn">{t(busy ? 'form.saving' : 'record.save')}</button>
    </fieldset></form>
  </SafeDialog>;
}
