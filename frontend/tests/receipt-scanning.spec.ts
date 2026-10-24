import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mockApp } from './helpers/mockApp';

async function receiptPhoto(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 700;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black'; context.font = '32px monospace';
    ['COOP MARKET', '', 'DOCUMENTO COMMERCIALE', '24/10/2026 16:42', '', 'PANE                  5,00', 'FRUTTA               15,00', '', 'TOTALE COMPLESSIVO   20,00', 'DI CUI IVA            1,82', 'CONTANTI             25,00', 'RESTO                 5,00'].forEach((line, index) => context.fillText(line, 45, 60 + index * 48));
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') };
}

async function openScanner(page: Page, italian = false) {
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: italian ? 'Nuova spesa' : 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('combobox', { name: italian ? 'Categoria' : 'Category', exact: true }).selectOption('1');
  await editor.getByRole('button', { name: italian ? 'Scansiona scontrino' : 'Scan receipt', exact: true }).click();
  return editor;
}

async function mockRecognition(page: Page, text: string | null, totalReadings?: string[], totalLabel = 'TOTALE COMPLESSIVO') {
  const firstResult = { text, confidence: 95, blocks: totalReadings ? [{ paragraphs: [{ lines: [{
    text: `${totalLabel} 2,%\n`, words: [
      { text: totalLabel.split(' ')[0], bbox: { x0: 45, y0: 420, x1: 180, y1: 460 } },
      { text: totalLabel.split(' ')[1], bbox: { x0: 190, y0: 420, x1: 420, y1: 460 } },
      { text: '2,%', bbox: { x0: 450, y0: 420, x1: 530, y1: 460 } },
    ],
  }] }] }] : null };
  await page.route('**/ocr/tesseract-7.0.0/lang/*', route => route.fulfill({ body: 'test language' }));
  await page.route('**/ocr/tesseract-7.0.0/worker.min.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    let readings = 0;
    self.onmessage = ({ data: request }) => {
      const { workerId, jobId, action } = request;
      if (action === 'recognize') {
        self.postMessage({ workerId, jobId, action, status: 'progress', data: { status: 'recognizing text', progress: 0.5 } });
        ${text === null ? 'return;' : ''}
      }
      const result = action === 'recognize' ? (readings++ === 0 ? ${JSON.stringify(firstResult)} : { text: (${JSON.stringify(totalReadings || [])})[readings - 2] || '', confidence: 95 }) : {};
      self.postMessage({ workerId, jobId, action, status: 'resolve', data: result });
    }` }));
}

test('real browser OCR fills a reviewed expense and preserves duplicate confirmation', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await mockApp(page, { withDashboardExpense: true, withDuplicateReview: true });
  const assets: string[] = [];
  const submissions: Record<string, unknown>[] = [];
  const unexpectedUploads: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/ocr/')) assets.push(request.url());
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/expenses') submissions.push(request.postDataJSON());
    else if (request.method() === 'POST') unexpectedUploads.push(request.url());
  });
  const editor = await openScanner(page);
  expect(assets).toHaveLength(0);
  const workers: boolean[] = [];
  page.on('worker', worker => {
    if (!worker.url().includes('/ocr/')) return;
    const index = workers.push(false) - 1;
    worker.on('close', () => { workers[index] = true; });
  });
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByLabel('Merchant (description)', { exact: true })).toHaveValue('COOP MARKET', { timeout: 45000 });
  await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue('20.00');
  await expect(editor.getByLabel('Date', { exact: true })).toHaveValue('2026-10-24');
  await expect(editor.getByLabel('Time', { exact: true })).toHaveValue('16:42');
  const photo = editor.locator('details').filter({ has: page.locator('summary', { hasText: 'Receipt photo' }) });
  if (!await photo.evaluate(element => (element as HTMLDetailsElement).open)) await photo.locator('summary').click();
  await expect(editor.getByRole('img', { name: 'Receipt photo to review' })).toBeVisible();
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every(url => new URL(url).origin === 'http://localhost:3100')).toBe(true);
  expect(assets.some(url => url.includes('/ocr/heif-'))).toBe(false);
  expect(submissions).toHaveLength(0);
  expect(unexpectedUploads).toHaveLength(0);
  await expect.poll(() => workers.length > 0 && workers.every(Boolean)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('receipt-review.png') });
  await editor.getByRole('button', { name: 'Continue to expense', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('20');
  await expect(editor.getByLabel('Description', { exact: true })).toHaveValue('COOP MARKET');
  await expect(editor.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('1');
  await expect(editor.getByLabel('Date & Time', { exact: true })).toHaveValue('2026-10-24T16:42');
  expect(submissions).toHaveLength(0);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByRole('heading', { name: 'Possible duplicate', exact: true })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].allow_duplicate).toBeUndefined();
  await editor.getByRole('button', { name: 'Save anyway', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toMatchObject({ amount: 20, category_id: 1, description: 'COOP MARKET', allow_duplicate: true });
});

test('ambiguous Italian receipt requires corrections and remains usable on a narrow dark screen', async ({ page }, testInfo) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.addInitScript(() => { localStorage.setItem('app_language', 'it'); localStorage.setItem('app_theme_active_user', '1'); localStorage.setItem('app_theme:1', 'dark'); });
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 640 });
  await mockRecognition(page, 'NEGOZIO\n24/10/2026\nTOTALE 20,00\nTOTAL 25,00');
  const editor = await openScanner(page, true);
  await editor.getByLabel('Scegli immagine', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByText('Sono presenti totali diversi: scegli l’importo finale da registrare.')).toBeVisible();
  await expect(editor.getByLabel('Importo (EUR)', { exact: true })).toHaveValue('');
  await expect(editor.getByLabel('Ora', { exact: true })).toHaveValue('');
  await editor.getByRole('button', { name: 'Continua alla spesa', exact: true }).click();
  await expect(editor.getByLabel('Importo (EUR)', { exact: true })).toBeFocused();
  await expect(editor.getByLabel('Importo (EUR)', { exact: true })).toHaveAttribute('aria-describedby', /receipt-amount-error/);
  await editor.getByLabel('Importo (EUR)', { exact: true }).fill('23,43');
  await editor.getByLabel('Ora', { exact: true }).fill('12:30');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('receipt-italian-dark.png') });
  await editor.getByRole('button', { name: 'Continua alla spesa', exact: true }).click();
  await expect(editor.getByLabel('Importo', { exact: true })).toHaveValue('23.43');
  await expect(editor.getByLabel('Data e Ora', { exact: true })).toHaveValue('2026-10-24T12:30');
});

test('invalid images and OCR download failures preserve the manual draft', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Amount', { exact: true }).fill('17.50');
  await editor.getByLabel('Description', { exact: true }).fill('Keep my draft');
  await editor.getByRole('button', { name: 'Scan receipt', exact: true }).click();
  const file = editor.getByLabel('Choose image', { exact: true });
  await file.setInputFiles({ name: 'document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await expect(editor.getByRole('alert')).toContainText('PDFs and other files are not supported');
  await file.setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('broken') });
  await expect(editor.getByRole('alert')).toContainText('cannot read the image');
  await file.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(12 * 1024 * 1024 + 1) });
  await expect(editor.getByRole('alert')).toContainText('exceeds 12 MB');
  await page.route('**/ocr/tesseract-7.0.0/lang/*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await file.setInputFiles(await receiptPhoto(page));
  await expect(editor.getByRole('alert')).toContainText('Reading failed');
  await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('17.50');
  await expect(editor.getByLabel('Description', { exact: true })).toHaveValue('Keep my draft');
  await expect(editor.getByLabel('Amount', { exact: true })).toBeFocused();
});

test('cancelling recognition terminates the worker and leaves the expense unsaved', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await mockRecognition(page, null);
  let terminated = false;
  page.on('worker', worker => { if (worker.url().includes('/ocr/')) worker.on('close', () => { terminated = true; }); });
  const editor = await openScanner(page);
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByText('Reading receipt…', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Stop reading', exact: true }).click();
  await expect.poll(() => terminated).toBe(true);
  await expect(editor.getByRole('button', { name: 'Choose image', exact: true })).toBeEnabled();
  await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('');
  await expect(editor.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('1');
  page.once('dialog', prompt => prompt.accept());
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor).toHaveCount(0);
});

test('a stalled recognition times out and returns to manual entry', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await mockRecognition(page, null);
  const editor = await openScanner(page);
  await page.clock.install();
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByText('Reading receipt…', { exact: true })).toBeVisible();
  await page.clock.fastForward(120001);
  await expect(editor.getByRole('alert')).toContainText('Reading stopped because it took too long');
  await expect(editor.getByRole('button', { name: 'Choose image', exact: true })).toBeEnabled();
  await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('');
});

test('closing a receipt review protects it even before the expense form changes', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await mockRecognition(page, 'SHOP\n24/10/2026 12:30\nTOTAL 20,00');
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'Scan receipt', exact: true }).click();
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue('20.00');
  let prompted = false;
  page.once('dialog', prompt => { prompted = true; void prompt.dismiss(); });
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  expect(prompted).toBe(true);
  await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue('20.00');
  await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('');
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor).toHaveCount(0);
});

test('HEIC bytes with a PNG filename decode locally and have a working preview', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await mockRecognition(page, 'SHOP\n24/10/2026 12:30\nTOTAL 12,34');
  const heifWorkers: boolean[] = [];
  page.on('worker', worker => {
    if (!worker.url().includes('/ocr/heif-')) return;
    const index = heifWorkers.push(false) - 1;
    worker.on('close', () => { heifWorkers[index] = true; });
  });
  const editor = await openScanner(page);
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'renamed.png', mimeType: 'image/png', buffer: readFileSync(path.join(__dirname, 'fixtures/receipt.heic')) });
  await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue('12.34', { timeout: 20000 });
  const photo = editor.locator('details').filter({ has: page.locator('summary', { hasText: 'Receipt photo' }) });
  if (!await photo.evaluate(element => (element as HTMLDetailsElement).open)) await photo.locator('summary').click();
  const preview = editor.getByRole('img', { name: 'Receipt photo to review' });
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => heifWorkers.length === 1 && heifWorkers.every(Boolean)).toBe(true);
});

test('cancelling HEIC conversion terminates the decoder before OCR starts', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.route('**/ocr/heif-1.23.5/worker.js', route => route.fulfill({ contentType: 'application/javascript', body: 'self.onmessage = () => {};' }));
  let terminated = false;
  let ocrRequested = false;
  page.on('worker', worker => { if (worker.url().includes('/ocr/heif-')) worker.on('close', () => { terminated = true; }); });
  page.on('request', request => { if (request.url().includes('/ocr/tesseract-')) ocrRequested = true; });
  const editor = await openScanner(page);
  const workerStarted = page.waitForEvent('worker');
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'receipt.heic', mimeType: 'image/heic', buffer: readFileSync(path.join(__dirname, 'fixtures/receipt.heic')) });
  await workerStarted;
  await editor.getByRole('button', { name: 'Stop reading', exact: true }).click();
  await expect.poll(() => terminated).toBe(true);
  expect(ocrRequested).toBe(false);
  await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('');
});

for (const label of ['TOTALE COMPLESSIVO', 'IMPORTO EUR']) {
  for (const agree of [true, false]) {
    test(`a condensed total is recovered only when close-up readings agree (${label}, ${agree})`, async ({ page }) => {
      await mockApp(page, { withDashboardExpense: true });
      await mockRecognition(page, `SHOP\n24/10/2026 12:30\n${label} 2,%\n`, ['22,95', agree ? '22.95' : '29,95'], label);
      const editor = await openScanner(page);
      await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
      await expect(editor.getByLabel('Merchant (description)', { exact: true })).toBeVisible();
      await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue(agree ? '22.95' : '');
    });
  }
}

test('an optional local receipt photo reaches an editable review', async ({ page }, testInfo) => {
  test.skip(!process.env.RECEIPT_TEST_IMAGE, 'Set RECEIPT_TEST_IMAGE to diagnose a local photo without committing it.');
  test.setTimeout(90000);
  await mockApp(page, { withDashboardExpense: true });
  const editor = await openScanner(page);
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(process.env.RECEIPT_TEST_IMAGE!);
  await expect(editor.getByLabel('Merchant (description)', { exact: true })).toBeVisible({ timeout: 75000 });
  const photo = editor.locator('details').filter({ has: page.locator('summary', { hasText: 'Receipt photo' }) });
  if (!await photo.evaluate(element => (element as HTMLDetailsElement).open)) await photo.locator('summary').click();
  const preview = editor.getByRole('img', { name: 'Receipt photo to review' });
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const fields = {
    merchant: await editor.getByLabel('Merchant (description)', { exact: true }).inputValue(),
    amount: await editor.getByLabel('Amount (EUR)', { exact: true }).inputValue(),
    date: await editor.getByLabel('Date', { exact: true }).inputValue(),
    time: await editor.getByLabel('Time', { exact: true }).inputValue(),
    text: await editor.locator('details pre').textContent(),
  };
  await testInfo.attach('local-receipt-diagnostics', { body: JSON.stringify(fields, null, 2), contentType: 'application/json' });
  if (process.env.RECEIPT_EXPECTED_AMOUNT) await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue(process.env.RECEIPT_EXPECTED_AMOUNT);
});

test('receipt entry sits above Type and is offered only for new one-off expenses', async ({ page }, testInfo) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  const scan = editor.getByRole('button', { name: 'Scan receipt', exact: true });
  const type = editor.getByRole('combobox', { name: 'Type', exact: true });
  const bounds = await scan.boundingBox();
  const typeBounds = await type.boundingBox();
  expect(bounds && typeBounds).toBeTruthy();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.y + bounds!.height).toBeLessThan(typeBounds!.y);
  expect(Math.abs(bounds!.width - typeBounds!.width)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('receipt-entry.png'), animations: 'disabled' });
  await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('income');
  await expect(scan).toHaveCount(0);
  await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('expense');
  await editor.getByRole('checkbox').check();
  await expect(scan).toHaveCount(0);
  await editor.getByRole('checkbox').uncheck();
  await scan.click();
  const camera = editor.getByRole('button', { name: 'Take photo', exact: true });
  if (testInfo.project.name === 'mobile') await expect(camera).toBeVisible();
  else await expect(camera).toBeHidden();
  await expect(editor.getByRole('button', { name: 'Choose image', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('receipt-selection.png') });
});

test('receipt review keeps actions visible while the photo and recognized text expand', async ({ page }, testInfo) => {
  await mockApp(page, { withDashboardExpense: true });
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 568 });
  await mockRecognition(page, ['SHOP', '24/10/2026 12:30', 'TOTAL 20,00', ...Array(35).fill('Product 1,00')].join('\n'));
  const editor = await openScanner(page);
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByRole('heading', { name: 'Review details', exact: true })).toBeFocused();
  const headingBounds = await editor.getByRole('heading', { name: 'Review details', exact: true }).boundingBox();
  const changeBounds = await editor.getByRole('button', { name: 'Change photo', exact: true }).boundingBox();
  expect(headingBounds && changeBounds).toBeTruthy();
  expect(Math.abs(headingBounds!.y + headingBounds!.height / 2 - changeBounds!.y - changeBounds!.height / 2)).toBeLessThan(2);
  const photo = editor.locator('details').filter({ has: page.locator('summary', { hasText: 'Receipt photo' }) });
  await expect(photo).toHaveJSProperty('open', testInfo.project.name === 'desktop');
  const continueButton = editor.getByRole('button', { name: 'Continue to expense', exact: true });
  const checkFooter = async () => {
    const bounds = await continueButton.boundingBox();
    const backBounds = await editor.getByRole('button', { name: 'Back to form', exact: true }).boundingBox();
    expect(bounds).toBeTruthy();
    expect(backBounds).toBeTruthy();
    expect(Math.abs(bounds!.y - backBounds!.y)).toBeLessThan(1);
    expect(Math.abs(bounds!.height - backBounds!.height)).toBeLessThan(1);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await continueButton.evaluate(button => {
      const bounds = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    })).toBe(true);
    expect(await editor.evaluate(dialog => dialog.scrollHeight <= dialog.clientHeight + 1)).toBe(true);
  };
  await checkFooter();
  await page.screenshot({ path: testInfo.outputPath('receipt-review-compact.png') });
  if (testInfo.project.name === 'mobile') await photo.locator('summary').click();
  await expect(editor.getByRole('img', { name: 'Receipt photo to review' })).toBeVisible();
  await editor.getByText('Show recognized text', { exact: true }).click();
  await checkFooter();
  await page.screenshot({ path: testInfo.outputPath('receipt-review-expanded.png') });
  await continueButton.click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('20');
  await expect(editor.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('1');
});

async function mockLayoutRecognition(page: Page, first: string, second: string | null, fail = false) {
  await mockRecognition(page, first);
  const modes: string[] = [];
  const workers: boolean[] = [];
  page.on('worker', worker => {
    if (!worker.url().includes('/ocr/tesseract-')) return;
    const index = workers.push(false) - 1;
    worker.on('close', () => { workers[index] = true; });
  });
  await page.route('**/__test_ocr_layout', route => {
    modes.push(route.request().postData()!);
    return route.fulfill({ body: 'ok' });
  });
  await page.route('**/ocr/tesseract-7.0.0/worker.min.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    let mode = '6';
    self.onmessage = async ({ data: request }) => {
      const { workerId, jobId, action } = request;
      if (action === 'setParameters') mode = request.payload.params.tessedit_pageseg_mode;
      if (action === 'recognize') {
        await fetch('/__test_ocr_layout', { method: 'POST', body: mode });
        self.postMessage({ workerId, jobId, action, status: 'progress', data: { status: 'recognizing text', progress: 0.5 } });
        if (mode === '3' && ${second === null}) return;
        if (mode === '3' && ${fail}) {
          self.postMessage({ workerId, jobId, action, status: 'reject', data: 'layout recognition failed' });
          return;
        }
      }
      const data = action === 'recognize' ? { text: mode === '3' ? ${JSON.stringify(second)} : ${JSON.stringify(first)}, confidence: 95, blocks: null } : {};
      self.postMessage({ workerId, jobId, action, status: 'resolve', data });
    }` }));
  return { modes, workers };
}

for (const scenario of [
  { name: 'oversized total', second: 'TOTALE EURO\n14.09', amount: '14.09' },
  { name: 'conflicting totals', second: 'TOTALE EURO 14.09\nTOTAL 15.00', amount: '' },
  { name: 'foreign currency', second: 'TOTAL USD 14.09', amount: '' },
  { name: 'unlabelled prices', second: 'PRODUCT 14.09\nVAT 1.28', amount: '' },
  { name: 'failed retry', second: '', amount: '', fail: true },
]) {
  test(`layout recovery preserves the first reading and handles ${scenario.name}`, async ({ page }) => {
    await mockApp(page, { withDashboardExpense: true });
    const { modes, workers } = await mockLayoutRecognition(page, 'SHOP\n24/10/2026 11:05', `OTHER SHOP\n25/10/2026 10:00\n${scenario.second}`, scenario.fail);
    const editor = await openScanner(page);
    await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
    await expect(editor.getByLabel('Amount (EUR)', { exact: true })).toHaveValue(scenario.amount);
    await expect(editor.getByLabel('Merchant (description)', { exact: true })).toHaveValue('SHOP');
    await expect(editor.getByLabel('Date', { exact: true })).toHaveValue('2026-10-24');
    await expect(editor.getByLabel('Time', { exact: true })).toHaveValue('11:05');
    await expect(editor.locator('details pre')).not.toContainText('OTHER SHOP');
    if (scenario.name === 'conflicting totals') await expect(editor.getByText('Different totals were found: choose the final amount to record.')).toBeVisible();
    expect(modes).toEqual(['6', '3']);
    await expect.poll(() => workers.length === 1 && workers.every(Boolean)).toBe(true);
  });
}

test('known, conflicting, foreign and labelled unreadable totals do not trigger a layout retry', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  for (const text of ['TOTAL 14.09', 'TOTAL 14.09\nTOTAL 15.00', 'TOTAL USD 14.09', 'USD 14.09', 'TOTALE EURO 2,%']) {
    const { modes, workers } = await mockLayoutRecognition(page, `SHOP\n24/10/2026 11:05\n${text}`, null);
    await editor.getByRole('button', { name: 'Scan receipt', exact: true }).click();
    await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
    await expect(editor.getByLabel('Merchant (description)', { exact: true })).toHaveValue('SHOP');
    expect(modes).toEqual(['6']);
    await expect.poll(() => workers.length === 1 && workers.every(Boolean)).toBe(true);
    await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  }
});

test('cancelling a layout retry terminates the same OCR worker', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  const { modes, workers } = await mockLayoutRecognition(page, 'SHOP\n24/10/2026 11:05', null);
  const editor = await openScanner(page);
  await editor.getByLabel('Choose image', { exact: true }).setInputFiles(await receiptPhoto(page));
  await expect(editor.getByText('Looking for the total…', { exact: true })).toBeVisible();
  await expect.poll(() => modes).toEqual(['6', '3']);
  await editor.getByRole('button', { name: 'Stop reading', exact: true }).click();
  expect(modes).toEqual(['6', '3']);
  await expect.poll(() => workers.length === 1 && workers.every(Boolean)).toBe(true);
  await expect(editor.getByRole('button', { name: 'Choose image', exact: true })).toBeFocused();
  await editor.getByRole('button', { name: 'Back to form', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveValue('');
});
