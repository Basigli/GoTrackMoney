import type { Worker as OcrWorker } from 'tesseract.js';

export type ReceiptProgress = { stage: 'preparing' | 'loading' | 'recognizing'; progress: number };
export class ReceiptImageError extends Error {
  constructor(public reason: 'file_type' | 'file_size' | 'image_decode') { super(reason); }
}

async function prepareImage(file: File, signal: AbortSignal): Promise<Blob> {
  if (!/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new ReceiptImageError('file_type');
  if (file.size > 12 * 1024 * 1024) throw new ReceiptImageError('file_size');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Image dimensions');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('Image encoding');
    return blob;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ReceiptImageError('image_decode');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function recognizeReceipt(file: File, signal: AbortSignal, onProgress: (progress: ReceiptProgress) => void): Promise<{ text: string; confidence: number }> {
  signal.throwIfAborted();
  onProgress({ stage: 'preparing', progress: 0 });
  const image = await prepareImage(file, signal);
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
      if (!signal.aborted) onProgress({ stage: message.status === 'recognizing text' ? 'recognizing' : 'loading', progress: message.progress });
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
    const { data } = await Promise.race([active.recognize(image), interrupted]);
    signal.throwIfAborted();
    return { text: data.text, confidence: data.confidence };
  } finally {
    signal.removeEventListener('abort', abort);
    await worker?.terminate();
  }
}
