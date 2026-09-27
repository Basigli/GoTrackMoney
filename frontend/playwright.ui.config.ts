import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'ui-refinements.spec.ts',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:8098' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
