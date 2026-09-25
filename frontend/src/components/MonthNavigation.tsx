'use client';
import { useLanguage } from '@/i18n/LanguageContext';
export default function MonthNavigation({ date, onChange, mode = 'month' }: { date: Date; onChange: (date: Date) => void; mode?: 'month' | 'year' }) {
  const { t } = useLanguage();
  const shift = (direction: number) => onChange(new Date(date.getFullYear() + (mode === 'year' ? direction : 0), date.getMonth() + (mode === 'month' ? direction : 0), 1));
  return <div className="month-navigation">
    <button className="secondary-btn" aria-label={t(mode === 'year' ? 'date.previous_year' : 'date.previous_month')} onClick={() => shift(-1)}>←</button>
    <button className="secondary-btn" onClick={() => onChange(new Date())}>{t(mode === 'year' ? 'date.this_year' : 'date.this_month')}</button>
    <button className="secondary-btn" aria-label={t(mode === 'year' ? 'date.next_year' : 'date.next_month')} onClick={() => shift(1)}>→</button>
  </div>;
}
