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
