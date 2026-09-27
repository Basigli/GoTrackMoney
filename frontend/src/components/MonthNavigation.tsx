'use client';

import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { it, enUS } from 'date-fns/locale';
import { useLanguage } from '@/i18n/LanguageContext';
import 'react-datepicker/dist/react-datepicker.css';

type PeriodInputProps = {
  value?: string;
  onClick?: () => void;
  label: string;
};

const PeriodInput = forwardRef<HTMLButtonElement, PeriodInputProps>(({ value, onClick, label }, ref) => (
  <button type="button" className="period-picker-button" onClick={onClick} ref={ref} aria-label={`${label}: ${value || ''}`}>
    <span aria-hidden="true">📅</span>
    <span>{value}</span>
  </button>
));
PeriodInput.displayName = 'PeriodInput';

export default function MonthNavigation({ date, onChange, mode = 'month' }: { date: Date; onChange: (date: Date) => void; mode?: 'month' | 'year' }) {
  const { t, language } = useLanguage();
  const now = new Date();
  const isCurrent = date.getFullYear() === now.getFullYear() && (mode === 'year' || date.getMonth() === now.getMonth());
  const shift = (direction: number) => onChange(new Date(
    date.getFullYear() + (mode === 'year' ? direction : 0),
    date.getMonth() + (mode === 'month' ? direction : 0),
    1,
  ));

  return <div className="month-navigation">
    <div className="month-navigation-main">
      <button type="button" className="secondary-btn month-arrow" aria-label={t(mode === 'year' ? 'date.previous_year' : 'date.previous_month')} onClick={() => shift(-1)}>←</button>
      <DatePicker
        selected={date}
        onChange={(value: Date | null) => value && onChange(value)}
        dateFormat={mode === 'year' ? 'yyyy' : 'MMM yyyy'}
        showMonthYearPicker={mode === 'month'}
        showYearPicker={mode === 'year'}
        customInput={<PeriodInput label={t(mode === 'year' ? 'date.choose_year' : 'date.choose_month')} />}
        locale={language === 'it' ? it : enUS}
        withPortal
      />
      <button type="button" className="secondary-btn month-arrow" aria-label={t(mode === 'year' ? 'date.next_year' : 'date.next_month')} onClick={() => shift(1)}>→</button>
    </div>
    {!isCurrent && <button type="button" className="period-reset" onClick={() => onChange(new Date())}>{t(mode === 'year' ? 'date.this_year' : 'date.this_month')}</button>}
  </div>;
}
