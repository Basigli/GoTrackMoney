import type { Language } from '@/i18n/translations';

export function formatMoney(amount: number, language: Language, signed = false): string {
  return new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-IE', {
    style: 'currency', currency: 'EUR', signDisplay: signed ? 'always' : 'auto',
  }).format(amount);
}
