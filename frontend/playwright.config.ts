import { defineConfig, devices } from '@playwright/test';

const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to a migrated PostgreSQL database ending in _test.');
}
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL:'http://localhost:3100', trace:'retain-on-failure' },
  projects: [
    { name:'desktop', use:{ ...devices['Desktop Chrome'] } },
    { name:'mobile', use:{ ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command:'go -C ../backend run ./cmd', url:'http://localhost:8198/health', env:{ PORT:':8198', GOOSE_DBSTRING:database }, reuseExistingServer:false },
    { command:'npm run dev -- --port 3100', url:'http://localhost:3100', env:{ NEXT_PUBLIC_API_URL:'http://localhost:8198' }, reuseExistingServer:false, timeout:120000 },
  ],
});
