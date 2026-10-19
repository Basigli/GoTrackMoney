import type { Language } from '@/i18n/translations';

const locales = { it: 'it-IT', en: 'en-IE' };

export function formatMoney(amount: number, language: Language, signed = false): string {
  return new Intl.NumberFormat(locales[language], {
    style: 'currency', currency: 'EUR', signDisplay: signed ? 'always' : 'auto',
  }).format(amount);
}

export function formatCompactMoney(amount: number, language: Language): string {
  return new Intl.NumberFormat(locales[language], {
    style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
  }).format(amount);
}
