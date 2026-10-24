import type { Page } from 'tesseract.js';
import { extractReceipt, isReceiptTotalLine, receiptAmount } from './receipts';

// Condensed thermal-printer digits can be unreadable at the page's text scale.
// Retry only an explicitly labelled total, and require two agreeing close-ups.
export async function recoverReceiptTotal(page: Pick<Page, 'text' | 'blocks'>, image: Blob, signal: AbortSignal,
  readDigits: (image: HTMLCanvasElement) => Promise<{ text: string; confidence: number }>): Promise<string> {
  const details = extractReceipt(page.text);
  if (!details.issues.includes('amount_missing') || details.issues.includes('currency_unsupported')) return page.text;
  const lines = page.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines)).filter(line => isReceiptTotalLine(line.text)) || [];
  if (lines.length !== 1 || !page.text.includes(lines[0].text)) return page.text;
  const words = lines[0].words.filter(word => /\d/.test(word.text));
  if (words.length !== 1) return page.text;
  const word = words[0];
  const url = URL.createObjectURL(image);
  const canvas = document.createElement('canvas');
  try {
    const source = new Image(); source.src = url; await source.decode();
    signal.throwIfAborted();
    const padding = Math.max(4, Math.round((word.bbox.y1 - word.bbox.y0) * .2));
    const x = Math.max(0, word.bbox.x0 - padding), y = Math.max(0, word.bbox.y0 - padding);
    const width = Math.min(source.naturalWidth, word.bbox.x1 + padding) - x;
    const height = Math.min(source.naturalHeight, word.bbox.y1 + padding) - y;
    if (width <= 0 || height <= 0) return page.text;
    const readings: string[] = [];
    const scale = Math.min(3, 200 / height);
    for (const stretch of [2, 2.5]) {
      canvas.width = Math.ceil(width * scale * stretch); canvas.height = Math.ceil(height * scale);
      const context = canvas.getContext('2d');
      if (!context) return page.text;
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
      signal.throwIfAborted();
      const result = await readDigits(canvas);
      signal.throwIfAborted();
      const amount = receiptAmount(result.text.trim());
      if (!amount || result.confidence < 75) return page.text;
      readings.push(amount);
    }
    return readings[0] === readings[1] ? page.text.replace(lines[0].text, lines[0].text.replace(word.text, readings[0])) : page.text;
  } finally {
    canvas.width = canvas.height = 0;
    URL.revokeObjectURL(url);
  }
}
