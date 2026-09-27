import { expect, test, type Page } from '@playwright/test';

async function mockApp(page: Page, options: { username?: string; isAdmin?: boolean; withChartData?: boolean } = {}) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('auth_token')) localStorage.setItem('auth_token', 'ui-test-token');
    if (!localStorage.getItem('app_language')) localStorage.setItem('app_language', 'en');
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
    const year = Number(url.searchParams.get('year'));
    const month = Number(url.searchParams.get('month'));
    const data = url.pathname === '/auth/me'
      ? { id: route.request().headers()['authorization']?.endsWith('-2') ? 2 : 1, username: options.username || 'ui-test', session_duration_hours: 24, is_admin: options.isAdmin || false }
      : url.pathname === '/transactions/search' ? emptySearch
      : url.pathname === '/categories' && options.withChartData ? [{ id: 1, name: 'Food', emoji: '🍴', type: 'expense', color: '#ff9078' }]
      : url.pathname === '/analytics/expenses-by-category' && options.withChartData ? [{ category_id: 1, total_amount: 25 }]
      : url.pathname === '/analytics/income-vs-expense' ? { incomes: options.withChartData ? [{ year, month, total_amount: 100 }] : [], expenses: options.withChartData ? [{ year, month, total_amount: 25 }] : [] }
      : url.pathname === '/periodic-expenses/upcoming' ? { total_7: 0, total_30: 0, items: [] }
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
  const modeToggle = page.getByRole('button', { name: 'Year', exact: true });
  await expect(modeToggle).toHaveCSS('border-radius', '12px');
  await modeToggle.click();
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

test('theme selection applies immediately and stays separate for each browser account', async ({ page }) => {
  await mockApp(page, { withChartData: true });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: test.info().outputPath('profile-dark.png') });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/analytics');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.recharts-sector')).toHaveCount(1);
  const sector = page.locator('.recharts-sector');
  let previousPath: string | null = null;
  await expect.poll(async () => {
    const path = await sector.getAttribute('d');
    const stable = path !== null && path === previousPath;
    previousPath = path;
    return stable;
  }, { timeout: 5000, intervals: [100] }).toBe(true);
  await page.screenshot({ path: test.info().outputPath('analytics-dark.png') });
  if (test.info().project.name === 'desktop') {
    const surface = await page.locator('.recharts-surface').first().boundingBox();
    expect(surface).not.toBeNull();
    await page.mouse.move(surface!.x + surface!.width / 2, surface!.y + surface!.height / 2 + 70);
    const tooltip = page.locator('.recharts-default-tooltip:visible');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveCSS('background-color', 'rgb(50, 51, 79)');
  }

  await page.evaluate(() => localStorage.setItem('auth_token', 'ui-test-token-2'));
  await page.goto('/profile');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => localStorage.setItem('auth_token', 'ui-test-token'));
  await page.goto('/profile');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  if (test.info().project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('app_theme:1'))).toBe('dark');
});

test('dark surfaces remain readable across app pages and dialogs', async ({ page }) => {
  await mockApp(page, { isAdmin: true, withChartData: true });
  await page.addInitScript(() => {
    localStorage.setItem('app_theme_active_user', '1');
    localStorage.setItem('app_theme:1', 'dark');
  });
  for (const [route, title, artifact] of [
    ['/', 'Total Balance', 'dashboard'],
    ['/search', 'Search', 'search'],
    ['/categories', 'My Categories', 'categories'],
    ['/periodic', 'Periodic Expense', 'periodic'],
    ['/admin', 'User Management', 'admin'],
  ]) {
    await page.goto(route);
    await expect(route === '/' ? page.getByText(title, { exact: true }) : page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(27, 28, 49)');
    await page.screenshot({ path: test.info().outputPath(`${artifact}-dark.png`) });
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose month:', exact: false }).click();
  await expect(page.locator('.react-datepicker')).toBeVisible();
  await expect(page.locator('.react-datepicker-year-header')).toHaveCSS('color', 'rgb(242, 243, 250)');
  await page.screenshot({ path: test.info().outputPath('datepicker-dark.png') });
});

test('navbar keeps Logout reachable at tablet and desktop widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await mockApp(page, { username: 'very-long-account-name-that-must-not-hide-logout', isAdmin: true });
  await page.goto('/');
  for (const language of ['en', 'it']) {
    await page.evaluate(value => localStorage.setItem('app_language', value), language);
    for (const width of [768, 769, 1023, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if (width < 1024) await page.getByRole('button', { name: language === 'it' ? 'Apri menu' : 'Open menu' }).click();
      const logout = page.getByRole('button', { name: language === 'it' ? 'Esci' : 'Logout' });
      await expect(logout).toBeVisible();
      const bounds = await logout.boundingBox();
      expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width).toBeTruthy();
      const profileBounds = await page.getByRole('link', { name: 'very-long-account-name-that-must-not-hide-logout' }).boundingBox();
      expect(profileBounds).not.toBeNull();
      if (width < 1024) {
        expect(Math.abs(profileBounds!.x + profileBounds!.width / 2 - (bounds!.x + bounds!.width / 2))).toBeLessThan(1);
      } else {
        expect(Math.abs(profileBounds!.y + profileBounds!.height / 2 - (bounds!.y + bounds!.height / 2))).toBeLessThan(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});
