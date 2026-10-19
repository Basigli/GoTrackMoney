'use client';

import { useRef, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import SafeDialog from '@/components/SafeDialog';
import EditorActions from '@/components/EditorActions';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Category } from '@/types/domain';
import { apiRequest } from '@/utils/api';
import { CATEGORY_COLORS, categoryColor } from '@/utils/categoryColors';
import styles from './Categories.module.css';

export default function CategoryEditor({ token, category, initialType, onClose, onSaved }: {
  token: string; category?: Category; initialType: Category['type']; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [initial] = useState(() => ({ name: category?.name || '', emoji: category?.emoji || '📝', type: category?.type || initialType, color: category ? categoryColor(category) : CATEGORY_COLORS[0] }));
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const ref = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => setForm(old => ({ ...old, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const invalid: Record<string, string> = {};
    if (!form.name.trim()) invalid.name = t('form.required');
    if (!form.emoji.trim()) invalid.emoji = t('form.required');
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    submitting.current = true;
    setBusy(true);
    setFailure('');
    try {
      await apiRequest<Category>(category ? `/categories/${category.id}` : '/categories', {
        method: category ? 'PUT' : 'POST', token, body: { ...form, name: form.name.trim(), emoji: form.emoji.trim() },
      });
      toast.success(t(category ? 'categories.success_update' : 'categories.success_create'));
      onSaved();
    } catch { setFailure(t('categories.error_save')); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <SafeDialog title={t(category ? 'categories.edit' : 'categories.new')} onClose={onClose} busy={busy} dirty={JSON.stringify(form) !== JSON.stringify(initial)}>
    {close => <form ref={ref} onSubmit={submit} noValidate className={styles.form}>
      <fieldset disabled={busy}>
        <div className={styles.fields}>
          <div>
            <label className={styles.label} htmlFor="category-emoji">{t('categories.emoji')}</label>
            <input id="category-emoji" value={form.emoji} onChange={event => update('emoji', event.target.value)} className={styles.emojiInput} aria-invalid={!!errors.emoji} aria-describedby={errors.emoji ? 'category-emoji-error' : undefined} />
            {errors.emoji && <p id="category-emoji-error" className="field-error">{errors.emoji}</p>}
          </div>
          <div>
            <label className={styles.label} htmlFor="category-name">{t('categories.name')}</label>
            <input id="category-name" data-initial-focus value={form.name} onChange={event => update('name', event.target.value)} className={styles.nameInput} placeholder={t('categories.name_placeholder')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'category-name-error' : undefined} />
            {errors.name && <p id="category-name-error" className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label className={styles.label} htmlFor="category-color">{t('categories.color')}</label>
            <div className={styles.colorInputWrap}><input id="category-color" type="color" value={form.color} onChange={event => update('color', event.target.value)} className={styles.colorInput} /></div>
          </div>
        </div>
        <div className={styles.typeOptions}>
          {(['expense', 'income'] as const).map(type => <label key={type} className={styles.typeOption}>
            <input type="radio" name="category-type" checked={form.type === type} onChange={() => update('type', type)} />{t('categories.type_' + type)}
          </label>)}
        </div>
        {failure && <p role="alert" className="field-error">{failure}</p>}
        <EditorActions onCancel={close} busy={busy} submitLabel={t(busy ? 'form.saving' : category ? 'categories.save_btn' : 'categories.add_btn')} />
      </fieldset>
    </form>}
  </SafeDialog>;
}
