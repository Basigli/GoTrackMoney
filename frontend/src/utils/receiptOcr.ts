import type { Worker as OcrWorker } from 'tesseract.js';
import { prepareReceiptImage } from './receiptImages';
import { recoverReceiptTotal } from './receiptTotalOcr';
import { extractReceipt, receiptTotalLines } from './receipts';
export { ReceiptImageError } from './receiptImages';

export type ReceiptProgress = { stage: 'preparing' | 'loading' | 'recognizing' | 'recovering'; progress: number };
export async function recognizeReceipt(file: File, signal: AbortSignal, onProgress: (progress: ReceiptProgress) => void): Promise<{ text: string; confidence: number; image: Blob }> {
  signal.throwIfAborted();
  onProgress({ stage: 'preparing', progress: 0 });
  const image = await prepareReceiptImage(file, signal);
  signal.throwIfAborted();
  onProgress({ stage: 'loading', progress: 0 });
  const assets = '/ocr/tesseract-7.0.0';
  // Check language downloads before starting the engine. Versioned HTTP caching
  // lets the worker reuse these files without fetching a second copy in production.
  await Promise.all(['ita', 'eng'].map(async code => {
    const response = await fetch(`${assets}/lang/${code}.traineddata.gz`, { signal, cache: 'force-cache' });
    if (!response.ok) throw new Error('OCR language unavailable');
    await response.arrayBuffer();
  }));
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  signal.throwIfAborted();
  let worker: OcrWorker | undefined;
  let recoveringLayout = false;
  let rejectError: (error: unknown) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { rejectError = reject; });
  const abort = () => {
    void worker?.terminate();
    rejectError(signal.reason || new DOMException('Aborted', 'AbortError'));
  };
  signal.addEventListener('abort', abort, { once: true });
  const ready = createWorker(['ita', 'eng'], OEM.LSTM_ONLY, {
    workerPath: `${assets}/worker.min.js`, corePath: `${assets}/core`, langPath: `${assets}/lang`,
    workerBlobURL: false, cacheMethod: 'none',
    logger: message => {
      if (signal.aborted) return;
      const readingStage = recoveringLayout ? 'recovering' : 'recognizing';
      onProgress({ stage: message.status === 'recognizing text' ? readingStage : 'loading', progress: message.progress });
    },
    errorHandler: error => rejectError(error),
  }).then(async value => {
    worker = value;
    if (signal.aborted) await value.terminate();
    return value;
  });
  try {
    const active = await Promise.race([ready, interrupted]);
    signal.throwIfAborted();
    await active.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
    const { data } = await Promise.race([active.recognize(image, {}, { text: true, blocks: true }), interrupted]);
    const readDigits = async (crop: HTMLCanvasElement) => {
      await active.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' });
      const result = await active.recognize(crop);
      return { text: result.data.text, confidence: result.data.confidence };
    };
    let text = await Promise.race([recoverReceiptTotal(data, image, signal, readDigits), interrupted]);
    let confidence = data.confidence;
    const details = extractReceipt(text);
    // A uniform-text layout can omit an entire oversized total line. Try one
    // automatic layout only when there is no total label to inspect up close.
    if (details.issues.includes('amount_missing') && !details.issues.includes('currency_unsupported') && !receiptTotalLines(text).length) {
      signal.throwIfAborted();
      recoveringLayout = true;
      onProgress({ stage: 'recovering', progress: 0 });
      try {
        await Promise.race([active.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '' }), interrupted]);
        const { data: layout } = await Promise.race([active.recognize(image, {}, { text: true, blocks: true }), interrupted]);
        const recovered = await Promise.race([recoverReceiptTotal(layout, image, signal, readDigits), interrupted]);
        const alternative = extractReceipt(recovered);
        if (!alternative.issues.includes('currency_unsupported') && (alternative.amount || alternative.issues.includes('amount_ambiguous'))) {
          text = [text, ...receiptTotalLines(recovered)].join('\n');
          confidence = Math.min(confidence, layout.confidence);
        }
      } catch {
        // An optional retry must not discard the first reading. Cancellation
        // still propagates so the worker is terminated immediately.
        signal.throwIfAborted();
      }
    }
    signal.throwIfAborted();
    return { text, confidence, image };
  } finally {
    signal.removeEventListener('abort', abort);
    await worker?.terminate();
  }
}
