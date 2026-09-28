'use client';
import { useRef, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import type { PeriodicExpense } from '@/types/domain';
import { useRecurringData } from '@/hooks/useRecurringData';
import { useLanguage } from '@/i18n/LanguageContext';
import { apiRequest } from '@/utils/api';
import AppShell from '@/components/AppShell';
import styles from './Periodic.module.css';
import RecurringEditor from '@/components/RecurringEditor';

export default function PeriodicPage() {
  const { token, user, loading } = useAuth();
  const { t, language } = useLanguage();
  const { data: snapshot, failed, refresh } = useRecurringData(token);
  const [editing, setEditing] = useState<PeriodicExpense | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const submitting = useRef(false);
  const action = async (item:PeriodicExpense, command:'pause'|'resume'|'skip'|'delete') => {
    if (submitting.current) return;
    if ((command === 'delete' || command === 'skip') && !window.confirm(t(command === 'delete' ? 'recurring.delete_confirm' : 'recurring.skip_confirm'))) return;
    submitting.current = true; setBusy(item.id);
    try {
      await apiRequest<void>('/periodic-expenses/' + item.id + (command === 'delete' ? '' : '/' + command), {
        method: command === 'delete' ? 'DELETE' : 'POST', token,
      });
      refresh(); toast.success(t('record.success_edit'));
    } catch { toast.error(t('form.save_error')); }
    finally { submitting.current = false; setBusy(null); }
  };
  if (loading || !user || !token) return null;
  const money = (amount:number) => new Intl.NumberFormat(language, { style:'currency', currency:'EUR' }).format(amount);
  return <AppShell>
    <main className="page-content">
      <h1>{t('record.periodic')}</h1>
      {!snapshot && <p role={failed ? 'alert' : 'status'}>{t(failed ? 'analytics.load_error' : 'analytics.loading')}
        {failed && <button className="secondary-btn" onClick={refresh}>{t('analytics.retry')}</button>}
      </p>}
      {snapshot && <>
        <div className="analytics-summary">
          <div className="analytics-card">{t('recurring.next_7')}<strong>{money(snapshot.upcoming.total_7)}</strong></div>
          <div className="analytics-card">{t('recurring.next_30')}<strong>{money(snapshot.upcoming.total_30)}</strong></div>
        </div>
        <p className="analytics-note">{t('recurring.explanation')}</p>
        {[false,true].map(paused => <section key={String(paused)}>
          <h2>{t(paused ? 'recurring.paused' : 'recurring.active')}</h2>
          <div className="list-container">{snapshot.schedules.filter(item => item.paused === paused).sort((a,b) => a.next_due_date.localeCompare(b.next_due_date) || a.id-b.id).map(item =>
            <div className={styles.card} key={item.id}>
              <button className="transaction-row" onClick={() => setEditing(item)} disabled={busy !== null}>
                <span><strong>{item.name}</strong><small>{snapshot.categories.find(c => c.id === item.category_id)?.name} · {t('recurring.every', { interval:String(item.period_interval), unit:t('record.' + item.period_unit).toLowerCase() })}</small>
                  <small>{t(paused ? 'recurring.paused' : 'recurring.next_due')}{!paused && ': ' + format(new Date(item.next_due_date), 'dd/MM/yyyy HH:mm')}</small></span>
                <strong>{money(item.amount)}</strong>
              </button>
              <div className="form-row">
                <button className="secondary-btn" disabled={busy !== null} onClick={() => action(item, paused ? 'resume' : 'pause')}>{t(paused ? 'recurring.resume' : 'recurring.pause')}</button>
                {!paused && <button className="secondary-btn" disabled={busy !== null} onClick={() => action(item,'skip')}>{t('recurring.skip')}</button>}
                <button className="secondary-btn danger" disabled={busy !== null} onClick={() => action(item,'delete')}>{t('form.delete')}</button>
              </div>
            </div>
          )}</div>
          {!snapshot.schedules.some(item => item.paused === paused) && <p className="analytics-note">{t('recurring.none')}</p>}
        </section>)}
        <details><summary>{t('recurring.upcoming')}</summary>
          {snapshot.upcoming.items.length === 0 && <p>{t('recurring.none')}</p>}
          {snapshot.upcoming.items.map(item => <div className="transaction-row" key={item.schedule_id + ':' + item.due_date}>
            <span>{item.name}<small>{format(new Date(item.due_date),'dd/MM/yyyy HH:mm')}</small></span><span>{money(item.amount)}</span>
          </div>)}
        </details>
      </>}
    </main>
    {editing && snapshot && <RecurringEditor item={editing} categories={snapshot.categories} token={token} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); toast.success(t('record.success_edit')); }} />}
  </AppShell>;
}
