import { expect, test, type Page } from '@playwright/test';

async function mockApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'ui-test-token');
    localStorage.setItem('app_language', 'en');
  });
  await page.route(/^http:\/\/localhost:(8098|8198)\//, route => {
    const url = new URL(route.request().url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const emptySearch = { items: [], total: 0, limit: 50, offset: 0 };
    const data = url.pathname === '/auth/me'
      ? { id: 1, username: 'ui-test', session_duration_hours: 24, is_admin: false }
      : url.pathname === '/transactions/search' ? emptySearch
      : url.pathname === '/analytics/income-vs-expense' ? { incomes: [], expenses: [] }
      : [];
    return route.fulfill({ json: data, headers });
  });
}

test('dashboard and analytics center the period picker between navigation arrows', async ({ page }) => {
  await mockApp(page);
  for (const url of ['/?month=2025-12', '/analytics?month=2025-12']) {
    await page.goto(url);
    const picker = page.getByRole('button', { name: /Choose month:/ });
    await expect(picker).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(url.startsWith('/analytics') ? 'analytics-period.png' : 'dashboard-period.png') });
    const bar = await page.locator('.month-navigation').boundingBox();
    const trigger = await picker.boundingBox();
    expect(bar && trigger).toBeTruthy();
    expect(Math.abs((trigger!.x + trigger!.width / 2) - (bar!.x + bar!.width / 2))).toBeLessThan(3);
    await expect(page.getByRole('button', { name: 'This month' })).toBeVisible();
    await picker.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.react-datepicker')).toBeVisible();
  }
  await page.goto('/?month=2025-12');
  await page.getByRole('button', { name: 'Year', exact: true }).click();
  await expect(page.getByRole('button', { name: /Choose year:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Previous year' }).click();
  await expect(page).toHaveURL(/month=2024-12/);
});

test('phone search collapses advanced filters without losing active criteria', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await mockApp(page);
  await page.goto('/search?type=expense&from=2025-12-01');
  await expect(page.getByRole('searchbox')).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Show filters 2' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('From', { exact: true })).toBeHidden();
  await expect(page.getByText('0 results found')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('search-collapsed.png') });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Hide filters 2' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2025-12-01');
  await page.getByRole('searchbox').fill('coffee');
  await page.getByRole('button', { name: 'Hide filters 2' }).click();
  await expect(page.getByLabel('From', { exact: true })).toBeHidden();
  await expect(page).toHaveURL(/q=coffee/);
  await page.getByRole('button', { name: 'Show filters 2' }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('button', { name: 'Hide filters', exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('wide search keeps advanced filters visible without a toggle', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await mockApp(page);
  await page.goto('/search');
  await expect(page.getByLabel('From', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show filters' })).toBeHidden();
});
