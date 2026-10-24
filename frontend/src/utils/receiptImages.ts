export class ReceiptImageError extends Error {
  constructor(public reason: 'file_type' | 'file_size' | 'image_decode') { super(reason); }
}

async function imageType(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  if (bytes[0] === 0x89 && new TextDecoder().decode(bytes.slice(1, 4)) === 'PNG') return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const header = new TextDecoder().decode(bytes);
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';
  if (header.slice(4, 8) === 'ftyp') {
    const size = new DataView(bytes.buffer).getUint32(0);
    for (let offset = 8; offset + 4 <= Math.min(size, bytes.length); offset += 4) {
      if (offset !== 12 && /^(?:heic|heix|hevc|hevx|heim|heis|hevm|hevs)$/.test(header.slice(offset, offset + 4))) return 'image/heic';
    }
  }
  return file.type;
}

async function decodeHeif(file: Blob, signal: AbortSignal): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  signal.throwIfAborted();
  const worker = new Worker('/ocr/heif-1.23.5/worker.js');
  let abort = () => {};
  try {
    return await new Promise<Blob>((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({ data }) => data.image instanceof Blob ? resolve(data.image) : reject(new ReceiptImageError('image_decode'));
      worker.onerror = () => reject(new ReceiptImageError('image_decode'));
      worker.postMessage(buffer, [buffer]);
    });
  } finally {
    signal.removeEventListener('abort', abort);
    worker.terminate();
  }
}

export async function prepareReceiptImage(file: File, signal: AbortSignal): Promise<Blob> {
  if (file.size > 12 * 1024 * 1024) throw new ReceiptImageError('file_size');
  const type = await imageType(file);
  signal.throwIfAborted();
  if (!/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(type)) throw new ReceiptImageError('file_type');
  // iPhone exports can have a misleading extension/MIME type. Use the detected
  // format for native decoding, then load the HEIF codec only if it is needed.
  const source = file.type === type ? file : new Blob([file], { type });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch (error) {
      signal.throwIfAborted();
      if (/^image\/hei[cf]$/i.test(type)) return await decodeHeif(source, signal);
      throw error;
    }
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
