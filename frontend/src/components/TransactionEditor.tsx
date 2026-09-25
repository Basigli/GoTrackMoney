'use client';
import { useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Category } from '@/hooks/useData';
import type { Transaction, TransactionType } from '@/utils/transactions';
import { API_BASE } from '@/utils/api';
import { useLanguage } from '@/i18n/LanguageContext';
import SafeDialog from './SafeDialog';

export interface SavedTransaction { type: TransactionType; category_id: number; date: string; deleted?: boolean }
export default function TransactionEditor({ token, categories, item, initialType = 'expense', initialCategory, initialDate = new Date(), onClose, onSaved }: {
  token: string; categories: Category[]; item?: Transaction | null; initialType?: TransactionType;
  initialCategory?: number; initialDate?: Date; onClose: () => void; onSaved: (record: SavedTransaction) => void;
}) {
  const { t, language } = useLanguage();
  const [initial] = useState(() => ({
    type: item?.type || initialType, amount: item ? String(item.amount) : '',
    category: String(item?.category_id || initialCategory || ''), description: item?.description || '',
    date: format(item ? new Date(item.date) : initialDate, "yyyy-MM-dd'T'HH:mm"),
    periodic: false, interval: '1', unit: 'months',
  }));
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const dirty = JSON.stringify(initial) !== JSON.stringify(form);
  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(old => ({ ...old, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const amount = Number(form.amount.replace(',', '.'));
    const date = new Date(form.date);
    const invalid: Record<string, string> = {};
    if (!Number.isFinite(amount) || amount <= 0) invalid.amount = t('form.amount_error');
    if (!categories.some(c => c.id === Number(form.category) && c.type === form.type)) invalid.category = t('form.category_error');
    if (!form.date || !Number.isFinite(date.getTime())) invalid.date = t('form.date_error');
    if (form.periodic && (!Number.isInteger(Number(form.interval)) || Number(form.interval) < 1 || Number(form.interval) > 10000)) invalid.interval = t('form.interval_error');
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    submitting.current = true; setBusy(true); setFailure('');
    const periodic = !item && form.type === 'expense' && form.periodic;
    const endpoint = periodic ? '/periodic-expenses' : '/' + (form.type === 'expense' ? 'expenses' : 'incomes') + (item ? '/' + item.id : '');
    const payload = {
      name: item?.name || categories.find(c => c.id === Number(form.category))!.name,
      description: form.description, amount, category_id: Number(form.category),
      ...(periodic ? { start_date: date.toISOString(), period_interval: Number(form.interval), period_unit: form.unit }
        : { [form.type === 'expense' ? 'spent_on' : 'received_on']: date.toISOString() }),
    };
    try {
      const res = await fetch(API_BASE + endpoint, {
        method: item ? 'PUT' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(t(item ? 'record.success_edit' : form.type === 'expense' ? 'record.success_expense' : 'record.success_income'));
      onSaved({ type: form.type, category_id: Number(form.category), date: date.toISOString() });
    } catch { setFailure(t('form.save_error')); }
    finally { submitting.current = false; setBusy(false); }
  };
  const remove = async () => {
    if (!item || submitting.current || !window.confirm(t('form.delete_confirm'))) return;
    submitting.current = true; setBusy(true); setFailure('');
    try {
      const res = await fetch(API_BASE + '/' + (item.type === 'expense' ? 'expenses' : 'incomes') + '/' + item.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error();
      toast.success(t('form.deleted'));
      onSaved({ type: item.type, category_id: item.category_id, date: item.date, deleted: true });
    } catch { setFailure(t('form.delete_error')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <SafeDialog title={t(item ? 'record.edit' : 'record.new')} dirty={dirty} busy={busy} onClose={onClose}>
    <form className="modal-form" onSubmit={save} noValidate>
      <fieldset disabled={busy}>
        <label>{t('record.type')}<select className="input-field" value={form.type} disabled={!!item}
          onChange={e => setForm(old => ({ ...old, type: e.target.value as TransactionType, category: '', periodic: false }))}>
          <option value="expense">{t('record.expense')}</option><option value="income">{t('record.income')}</option>
        </select></label>
        <label>{t('record.amount')}<input data-initial-focus className="input-field" inputMode="decimal" value={form.amount}
          aria-invalid={!!errors.amount} aria-describedby="amount-error" onChange={e => update('amount', e.target.value)} /></label>
        {errors.amount && <p id="amount-error" className="field-error">{errors.amount}</p>}
        <label>{t('record.category')}<select className="input-field" value={form.category} aria-invalid={!!errors.category} onChange={e => update('category', e.target.value)}>
          <option value="">{t('record.select_category')}</option>
          {categories.filter(c => c.type === form.type).sort((a,b) => a.name.localeCompare(b.name, language, { sensitivity: 'base' })).map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select></label>
        {errors.category && <p className="field-error">{errors.category}</p>}
        <label>{t('record.date_time')}<input className="input-field" type="datetime-local" value={form.date} aria-invalid={!!errors.date} onChange={e => update('date', e.target.value)} /></label>
        {errors.date && <p className="field-error">{errors.date}</p>}
        <label>{t('record.description')}<input className="input-field" value={form.description} onChange={e => update('description', e.target.value)} /></label>
        {!item && form.type === 'expense' && <label><input type="checkbox" checked={form.periodic} onChange={e => update('periodic', e.target.checked)} /> {t('record.periodic')}</label>}
        {form.periodic && <div className="form-row">
          <label>{t('recurring.interval')}<input className="input-field" type="number" min="1" max="10000" value={form.interval} onChange={e => update('interval', e.target.value)} /></label>
          <label>{t('recurring.unit')}<select className="input-field" value={form.unit} onChange={e => update('unit', e.target.value)}>
            {['days','weeks','months','years'].map(unit => <option key={unit} value={unit}>{t('record.' + unit)}</option>)}
          </select></label>
        </div>}
        {errors.interval && <p className="field-error">{errors.interval}</p>}
        {failure && <p role="alert" className="field-error">{failure}</p>}
        <div className="form-row">
          {item && <button type="button" className="secondary-btn danger" onClick={remove}>{t('form.delete')}</button>}
          <button className="submit-btn" type="submit">{t(busy ? 'form.saving' : 'record.save')}</button>
        </div>
      </fieldset>
    </form>
  </SafeDialog>;
}
