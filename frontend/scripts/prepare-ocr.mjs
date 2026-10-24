import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = join(root, 'public/ocr/tesseract-7.0.0');
await mkdir(join(destination, 'core'), { recursive: true });
await mkdir(join(destination, 'lang'), { recursive: true });
const runtime = dirname(require.resolve('tesseract.js/package.json'));
const core = dirname(require.resolve('tesseract.js-core/package.json'));
await copyFile(join(runtime, 'dist/worker.min.js'), join(destination, 'worker.min.js'));
await copyFile(join(runtime, 'dist/worker.min.js.LICENSE.txt'), join(destination, 'worker.min.js.LICENSE.txt'));
// The runtime selects the appropriate SIMD/LSTM build for the device.
for (const name of await readdir(core)) {
  if (/^tesseract-core.*\.wasm\.js$/.test(name)) await copyFile(join(core, name), join(destination, 'core', name));
}
for (const language of ['ita', 'eng']) {
  const source = dirname(require.resolve(`@tesseract.js-data/${language}/package.json`));
  await copyFile(join(source, '4.0.0_best_int', `${language}.traineddata.gz`), join(destination, 'lang', `${language}.traineddata.gz`));
}
await copyFile(join(runtime, 'LICENSE.md'), join(destination, 'LICENSE-tesseract.txt'));
await copyFile(join(core, 'LICENSE'), join(destination, 'LICENSE-core.txt'));
