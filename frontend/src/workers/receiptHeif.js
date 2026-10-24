/* global importScripts, libheif */

// Served separately so the codec is never loaded for JPEG/PNG/WebP or when the
// browser already supports HEIC. Cancelling terminates this worker immediately.
self.onmessage = async ({ data }) => {
  let images = [];
  try {
    importScripts('./libheif-bundle.js');
    const engine = await libheif();
    images = new engine.HeifDecoder().decode(new Uint8Array(data));
    const image = images.find(value => value.is_primary()) || images[0];
    if (!image) throw new Error('No HEIF image');
    const width = image.get_width(), height = image.get_height();
    if (!width || !height || width * height > 40000000) throw new Error('Image dimensions');
    const pixels = await new Promise((resolve, reject) => {
      image.display({ width, height, data: new Uint8ClampedArray(width * height * 4) }, result => result ? resolve(result) : reject(new Error('HEIF decoding failed')));
    });
    const source = new OffscreenCanvas(width, height);
    source.getContext('2d').putImageData(new ImageData(pixels.data, width, height), 0, 0);
    const scale = Math.min(1, 2400 / Math.max(width, height));
    const output = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
    const context = output.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(source, 0, 0, output.width, output.height);
    const imageBlob = await output.convertToBlob({ type: 'image/png' });
    self.postMessage({ image: imageBlob });
  } catch {
    self.postMessage({ error: true });
  } finally {
    images.forEach(image => image.free());
    self.close();
  }
};
