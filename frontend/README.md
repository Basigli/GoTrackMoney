# GoTrackMoney frontend

Next.js 16 and React 19 frontend for the dashboard, transactions, categories, recurring payments, search, analytics, profile, and administration.

## Development

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the backend base URL when it is not running at `http://localhost:8098`. The frontend preserves the existing API routes and browser storage keys used by deployed versions.

## Structure

- `src/auth/SessionContext.tsx` owns session restoration, login, registration, and logout. `AppShell` renders the shared navigation for signed-in pages.
- `src/utils/api.ts` is the typed request and error boundary. Domain response types live in `src/types/domain.ts`; focused hooks in `src/hooks/` load page data and discard stale responses.
- `src/app/globals.css` contains theme tokens, base styles, and shared controls. Page layouts use nearby CSS Modules. The language and theme providers keep their existing browser preferences.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npx playwright test --config playwright.ui.config.ts
```

The UI Playwright suite uses mocked API responses and needs no database. The broader suite in `tests/usability.spec.ts` uses a real backend and requires `TEST_DATABASE_URL` pointing to a migrated PostgreSQL database whose name ends in `_test`; run it with `npx playwright test`.

## Receipt scanning

New, non-recurring expenses offer **Scan receipt**. Choose a photo or use the phone's native camera picker, review the extracted merchant, total, purchase date and time, and select **Use these details**. This fills the existing expense form and preserves its selected category. Saving remains explicit and uses the existing validation and duplicate review. Scanning is unavailable when editing entries or creating income or recurring payments.

Photos and recognized receipt text stay in browser memory; they are not uploaded or stored. Only the expense fields are sent when the user saves. Tesseract.js runs recognition in a browser worker, loaded after image selection. Italian and English language data and worker/core files are served from this app, without a third-party OCR service. Normal browsing does not load these assets. The first scan downloads several megabytes; later scans can use the browser's HTTP cache.

`npm run dev` and `npm run build` prepare the versioned OCR assets under `public/ocr/` from pinned npm packages. These generated files are ignored by Git. The existing frontend Dockerfile copies them into the production image automatically; no backend service, database migration, GPU or OCR installation on the host is needed. If you upgrade the runtime or language packages, also change the asset path in `scripts/prepare-ocr.mjs` and `src/utils/receiptOcr.ts` to invalidate cached assets. Both paths currently use `tesseract-7.0.0`.

The scanner accepts JPEG, PNG, WebP and HEIC/HEIF images up to 12 MB. It detects image formats from file headers, including HEIC photos renamed to `.png`. Native decoding is tried first; browsers without HEIC support load the self-hosted, pinned libheif-js decoder in a cancellable worker. That codec is not downloaded for ordinary images. Preview and OCR use a decoded PNG in memory, with orientation applied and the longest edge limited to 2400 pixels. Unsupported images, download errors, empty text and a two-minute timeout leave manual entry available. Active recognition and HEIC conversion are terminated on cancellation or closing; cancellation during OCR engine startup releases the worker when initialization completes. Decoder assets and its license/source reference are packaged under `public/ocr/heif-1.23.5/`; bump that path in the asset script and image helper if the decoder or its worker changes.

Extraction is deliberately conservative: totals must have an explicit total/due label, VAT/subtotals/cash/change are excluded, conflicting totals or dates stay blank, and foreign currencies are never silently treated as euros. Supported dates are day/month/year and ISO year-month-day. Date and time must be reviewed and completed before applying; missing times are not invented. No category is inferred automatically. Poor photos, unusual layouts, rotated text, localized month names and OCR errors can require manual correction.

If an explicit total label is found but its condensed digits are unreadable, OCR retries only that numeric region at two wider scales. It accepts the result only when both readings have sufficient OCR confidence and agree on a valid amount with two decimal places. Subtotals and payment values are not used as substitutes. Merchant selection skips marketing/social headers before the printed business name.

`receipt-parser.spec.ts` covers the extraction rules. `receipt-scanning.spec.ts` includes real browser OCR of a generated receipt, review and duplicate confirmation, narrow-screen Italian/dark styling, image/download failures, draft preservation and worker cancellation. Run these with `npx playwright test --config playwright.ui.config.ts receipt-parser.spec.ts receipt-scanning.spec.ts`. These checks use Chromium desktop/mobile emulation; accuracy and camera/HEIC behavior should also be evaluated with representative receipts on physical phones.

The committed HEIC fixture is synthetic. To reproduce a real photo locally without committing it, set `RECEIPT_TEST_IMAGE` to its absolute path and run the `optional local receipt` test. `RECEIPT_EXPECTED_AMOUNT` optionally checks its total; diagnostic attachments stay in ignored test output.
