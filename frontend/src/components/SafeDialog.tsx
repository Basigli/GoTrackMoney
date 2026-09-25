'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

export default function SafeDialog({ title, dirty = false, busy = false, onClose, children }: {
  title: string; dirty?: boolean; busy?: boolean; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  const close = () => {
    if (!busy && (!dirty || window.confirm(t('form.discard')))) onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const focus = dialog?.querySelector<HTMLElement>('[data-initial-focus]');
    focus?.focus();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return;
      if (busy || !window.confirm(t('form.discard'))) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, busy, t]);
  return <dialog ref={ref} className="editor-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="editor-body">
      <button className="modal-close" type="button" aria-label={t('form.close')} disabled={busy} onClick={close}>×</button>
      <h2>{title}</h2>
      {children}
      <button className="secondary-btn" type="button" disabled={busy} onClick={close}>{t('auth.cancel')}</button>
    </div>
  </dialog>;
}
