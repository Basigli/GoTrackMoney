import { expect, test } from '@playwright/test';
import { extractReceipt, receiptAmount } from '../src/utils/receipts';

test('Italian receipt extracts the grand total and ignores VAT, cash and change', () => {
  expect(extractReceipt(`COOP SUPERMERCATO
Via Roma 10
DOCUMENTO COMMERCIALE
24/10/2026 16:42:08
SUBTOTALE 25,00
SCONTO 1,57
TOTALE COMPLESSIVO 23,43
DI CUI IVA 2,13
CONTANTI 30,00
RESTO 6,57`)).toEqual({ merchant: 'COOP SUPERMERCATO', amount: '23.43', date: '2026-10-24', time: '16:42', issues: [] });
});

test('English receipt supports grouped amounts, ISO dates and totals on the next line', () => {
  expect(extractReceipt(`FOOD MARKET
2026-10-24 09:05
SUBTOTAL 1,200.00
GRAND TOTAL
EUR 1,234.56
VAT 34.56
CASH 1,300.00
CHANGE 65.44`).amount).toBe('1234.56');
  expect(receiptAmount('1.234,56')).toBe('1234.56');
  expect(receiptAmount('1 234,56 €')).toBe('1234.56');
  for (const value of ['-12,34', '1,23,45', '12.345', '0,00', '1234567890.00']) expect(receiptAmount(value)).toBeNull();
});

test('conflicting totals require review and repeated matching totals are accepted', () => {
  expect(extractReceipt('SHOP\nTOTALE 20,00\nTOTAL 25,00')).toMatchObject({ amount: '', issues: expect.arrayContaining(['amount_ambiguous']) });
  expect(extractReceipt('SHOP\nTOTALE 20,00\nTOTAL 20.00').amount).toBe('20.00');
  expect(extractReceipt('SHOP\nTOTAL 20,00 25,00').amount).toBe('');
});

test('subtotals, payments, item prices and taxes never become a guessed total', () => {
  for (const text of ['TOTAL VAT 2.00', 'TOTALE IVA 2,00', 'SUBTOTALE 20,00', 'TOTALE NON RISCOSSO 20,00', 'TOTAL SAVINGS 5.00', 'CASH 50.00\nCHANGE 10.00', 'APPLE 2,00\nBREAD 3,00']) {
    expect(extractReceipt(text).amount).toBe('');
  }
});

test('foreign currency is never silently entered as euros', () => {
  for (const currency of ['USD', '$', 'GBP', '£', 'CHF', 'JPY']) {
    expect(extractReceipt(`SHOP\nTOTAL ${currency} 20.00`)).toMatchObject({ amount: '', issues: expect.arrayContaining(['currency_unsupported']) });
  }
});

test('invalid or conflicting dates and missing times remain empty', () => {
  expect(extractReceipt('SHOP\n31/02/2026\nTOTAL 10,00').date).toBe('');
  expect(extractReceipt('SHOP\n29/02/2024\nTOTAL 10,00').date).toBe('2024-02-29');
  expect(extractReceipt('SHOP\n24.10.26\nTOTAL 10,00')).toMatchObject({ date: '2026-10-24', time: '', issues: expect.arrayContaining(['time_missing']) });
  expect(extractReceipt('SHOP\n24/10/2026\n25/10/2026').date).toBe('');
  expect(extractReceipt('SHOP\n25:70').time).toBe('');
  expect(extractReceipt('SHOP\n10:00\n11:00').time).toBe('');
  expect(extractReceipt('SHOP\n2026-10-24 00:00')).toMatchObject({ date: '2026-10-24', time: '00:00' });
});

test('empty text never invents financial information or a merchant', () => {
  expect(extractReceipt('')).toEqual({ merchant: '', amount: '', date: '', time: '', issues: ['amount_missing', 'date_missing', 'time_missing', 'merchant_missing'] });
  expect(extractReceipt('DOCUMENTO COMMERCIALE\nVia Roma 10\nP.IVA 123456789\nTOTALE 10,00').merchant).toBe('');
});

test('merchant selection skips marketing and social headers before the business name', () => {
  expect(extractReceipt('A\npp\n1\nun mondo per la casa\nSEGUICI SU\nTikTok\nAB\n1\n@exampleshop\nExample Market\nVia Roma 1\nDOCUMENTO COMMERCIALE\nTOTAL 12,34').merchant).toBe('Example Market');
});
