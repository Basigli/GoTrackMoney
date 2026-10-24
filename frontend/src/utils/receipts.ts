export type ReceiptIssue = 'amount_missing' | 'amount_ambiguous' | 'date_missing' | 'date_ambiguous' | 'time_missing' | 'merchant_missing' | 'currency_unsupported';

export interface ReceiptDetails {
  merchant: string;
  amount: string;
  date: string;
  time: string;
  issues: ReceiptIssue[];
}

const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const totalLabel = /\b(?:TOTALE(?:\s+(?:COMPLESSIVO|DOCUMENTO|DA PAGARE|EURO))?|GRAND TOTAL|TOTAL(?:\s+DUE)?|AMOUNT DUE|BALANCE DUE)\b/;
const notTotal = /\b(?:SUB\s?TOTAL[EI]?|IVA|VAT|TAX|TASSE|RESTO|CHANGE|CONTANTI|CASH|PAGAMENTO|PAYMENT|CARTA|CARD|BANCOMAT|POS|SCONTO|SCONTI|DISCOUNT|SAVINGS|RISPARMIO|NON PAGATO|NON RISCOSSO)\b/;

export function isReceiptTotalLine(line: string): boolean {
  const label = normalize(line);
  return totalLabel.test(label) && !notTotal.test(label);
}

// Keep cents exact and support both 1.234,56 and 1,234.56.
export function receiptAmount(value: string): string | null {
  const compact = value.replace(/[\s€]/g, '');
  const decimal = compact.slice(-3, -2);
  if (!/[.,]/.test(decimal) || !/^\d{2}$/.test(compact.slice(-2))) return null;
  const whole = compact.slice(0, -3);
  const grouping = decimal === ',' ? '.' : ',';
  if (!/^\d+$/.test(whole) && !new RegExp(`^\\d{1,3}(?:\\${grouping}\\d{3})+$`).test(whole)) return null;
  const digits = whole.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
  if (digits.length > 9 || Number(digits + compact.slice(-2)) === 0) return null;
  return digits + '.' + compact.slice(-2);
}

function amounts(line: string): string[] {
  return [...line.matchAll(/(?:^|[^\d.,-])(\d+(?:[., ]\d{3})*[.,]\d{2})(?![\d.,])/g)]
    .flatMap(match => { const value = receiptAmount(match[1]); return value ? [value] : []; });
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function extractReceipt(text: string): ReceiptDetails {
  const lines = text.slice(0, 50000).normalize('NFKC').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const issues: ReceiptIssue[] = [];
  const totals = new Set<string>();
  lines.forEach((line, index) => {
    if (!isReceiptTotalLine(line)) return;
    let values = amounts(line);
    // Some receipts print the total on the line immediately below its label.
    if (!values.length && index + 1 < lines.length && /^(?:EUR\s*|€\s*)?[\d., ]+(?:\s*EUR|\s*€)?$/i.test(lines[index + 1])) values = amounts(lines[index + 1]);
    values.forEach(value => totals.add(value));
  });
  const unsupportedCurrency = /[$£¥]|\b(?:USD|GBP|CHF|CAD|AUD|JPY|CNY|SEK|NOK|DKK|PLN|RON|TRY)\b/i.test(text);
  let amount = totals.size === 1 ? [...totals][0] : '';
  if (!totals.size) issues.push('amount_missing');
  if (totals.size > 1) issues.push('amount_ambiguous');
  if (unsupportedCurrency) { amount = ''; issues.push('currency_unsupported'); }

  const dates = new Set<string>();
  for (const line of lines) {
    for (const match of line.matchAll(/\b(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2}))\b/g)) {
      const year = match[1] ? Number(match[1]) : Number(match[6]) + (match[6].length === 2 ? 2000 : 0);
      const value = validDate(year, Number(match[2] || match[5]), Number(match[3] || match[4]));
      if (value) dates.add(value);
    }
  }
  const date = dates.size === 1 ? [...dates][0] : '';
  if (!dates.size) issues.push('date_missing');
  if (dates.size > 1) issues.push('date_ambiguous');
  const times = new Set(lines.flatMap(line => [...line.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/g)].map(match => `${match[1].padStart(2, '0')}:${match[2]}`)));
  const time = times.size === 1 ? [...times][0] : '';
  if (!time) issues.push('time_missing');

  const headerEnd = lines.findIndex(line => /\b(?:DOCUMENTO COMMERCIALE|FISCAL RECEIPT)\b/.test(normalize(line)));
  const merchant = lines.slice(0, headerEnd < 0 ? 20 : Math.min(headerEnd, 20)).find(line => {
    const value = normalize(line);
    return /[A-Z]{3}/.test(value) && line.length <= 100 &&
      !line.includes('@') && !/\b(?:UN MONDO PER|SEGUICI|FOLLOW|TIKTOK|INSTAGRAM|FACEBOOK)\b/.test(value) &&
      !/\b(?:DOCUMENTO|COMMERCIALE|RICEVUTA|SCONTRINO|FISCALE|RECEIPT|WELCOME|BENVENUTI|GRAZIE|THANK|COPIA|VIA|VIALE|PIAZZA|STREET|ROAD|TEL|TELEFONO|P[ .]?IVA|PARTITA|WWW|HTTP|DATA|DATE|ORA|TOTALE|TOTAL)\b/.test(value) &&
      (value.match(/\d/g)?.length || 0) < value.replace(/[^A-Z]/g, '').length;
  }) || '';
  if (!merchant) issues.push('merchant_missing');
  return { merchant, amount, date, time, issues };
}
