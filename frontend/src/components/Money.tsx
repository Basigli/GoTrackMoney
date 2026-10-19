import { useLanguage } from '@/i18n/LanguageContext';
import { formatMoney } from '@/utils/money';

export default function Money({ amount, signed = false }: { amount: number; signed?: boolean }) {
  const { language } = useLanguage();
  return <span className="money">{formatMoney(amount, language, signed)}</span>;
}
