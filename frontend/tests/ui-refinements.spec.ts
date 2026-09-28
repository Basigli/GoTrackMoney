import { expect, test, type Page } from '@playwright/test';

async function mockApp(page: Page, options: { username?: string; isAdmin?: boolean; withChartData?: boolean; startAnonymous?: boolean; startToken?: string; withDashboardExpense?: boolean; failFirstExpenseSave?: boolean; withRecurring?: boolean } = {}) {
  await page.addInitScript(({ startAnonymous, startToken }: { startAnonymous: boolean; startToken?: string }) => {
    if (!sessionStorage.getItem('ui-test-initialized')) {
      sessionStorage.setItem('ui-test-initialized', 'true');
      if (!startAnonymous) localStorage.setItem('auth_token', startToken || 'ui-test-token');
    }
    if (!localStorage.getItem('app_language')) localStorage.setItem('app_language', 'en');
  }, { startAnonymous: options.startAnonymous || false, startToken: options.startToken });
  let currentUsername = options.username || 'ui-test';
  let categories = options.withChartData || options.withDashboardExpense || options.withRecurring ? [{ id: 1, name: 'Food', emoji: '🍴', type: 'expense', color: '#ff9078' }] : [];
  let expenses = options.withDashboardExpense ? [{ id: 1, name: 'Food', amount: 20, description: 'Dinner', category_id: 1, spent_on: '2024-02-15T12:00:00Z' }] : [];
  let expenseSaveAttempts = 0;
  let schedules = options.withRecurring ? [{ id: 1, name: 'Daily coffee', amount: 5, description: '', category_id: 1, paused: false, schedule_anchor: '2026-01-01T12:00:00Z', period_interval: 1, period_unit: 'days', start_date: '2026-01-01T12:00:00Z', next_due_date: '2026-01-02T12:00:00Z' }] : [];
  await page.route(/^http:\/\/localhost:(8098|8198)\//, route => {
    const url = new URL(route.request().url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/auth/me' && route.request().headers()['authorization']?.endsWith('expired')) return route.fulfill({ status: 401, body: 'expired', headers });
    if (url.pathname === '/auth/login' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { username: string; password: string };
      if (body.password === 'wrong') return route.fulfill({ status: 401, body: 'invalid', headers });
      currentUsername = body.username;
      return route.fulfill({ json: { token: 'ui-test-token', user: { id: 1, username: currentUsername, session_duration_hours: 24, is_admin: false } }, headers });
    }
    if (url.pathname === '/users' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { username: string };
      if (body.username === 'taken') return route.fulfill({ status: 409, body: 'taken', headers });
      currentUsername = body.username;
      return route.fulfill({ json: { token: 'ui-test-token', user: { id: 1, username: currentUsername, session_duration_hours: 24, is_admin: false } }, headers });
    }
    if (url.pathname === '/users/me' && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { username: string; session_duration_hours: number };
      currentUsername = body.username;
      return route.fulfill({ json: { id: 1, username: currentUsername, session_duration_hours: body.session_duration_hours, is_admin: false }, headers });
    }
    if (url.pathname === '/users/me' && route.request().method() === 'DELETE') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/expenses' && route.request().method() === 'POST') {
      expenseSaveAttempts++;
      if (options.failFirstExpenseSave && expenseSaveAttempts === 1) return route.fulfill({ status: 500, body: 'unavailable', headers });
      const body = route.request().postDataJSON() as Omit<(typeof expenses)[number], 'id'>;
      const expense = { ...body, id: expenses.length + 1 };
      expenses = [...expenses, expense];
      return route.fulfill({ json: expense, headers });
    }
    if (url.pathname.startsWith('/periodic-expenses/') && route.request().method() === 'POST') {
      const id = Number(url.pathname.split('/')[2]);
      const action = url.pathname.split('/')[3];
      schedules = schedules.map(schedule => schedule.id === id ? { ...schedule, paused: action === 'pause' ? true : action === 'resume' ? false : schedule.paused } : schedule);
      return route.fulfill({ json: {}, headers });
    }
    if (url.pathname === '/categories' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Omit<(typeof categories)[number], 'id'>;
      const category = { ...body, id: categories.length + 1 };
      categories = [...categories, category];
      return route.fulfill({ json: category, headers });
    }
    if (url.pathname.startsWith('/categories/') && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Omit<(typeof categories)[number], 'id'>;
      const id = Number(url.pathname.split('/').pop());
      categories = categories.map(category => category.id === id ? { ...body, id } : category);
      return route.fulfill({ json: { ...body, id }, headers });
    }
    const emptySearch = { items: [], total: 0, limit: 50, offset: 0 };
    const year = Number(url.searchParams.get('year'));
    const month = Number(url.searchParams.get('month'));
    const data = url.pathname === '/auth/me'
      ? { id: route.request().headers()['authorization']?.endsWith('-2') ? 2 : 1, username: currentUsername, session_duration_hours: 24, is_admin: options.isAdmin || false }
      : url.pathname === '/transactions/search' ? emptySearch
      : url.pathname === '/categories' ? categories
      : url.pathname === '/analytics/expenses-by-category' && options.withChartData ? [{ category_id: 1, total_amount: 25 }]
      : url.pathname === '/analytics/income-vs-expense' ? { incomes: options.withChartData ? [{ year, month, total_amount: 100 }] : [], expenses: options.withChartData ? [{ year, month, total_amount: 25 }] : [] }
      : url.pathname === '/expenses/filter' ? expenses.filter(expense => { const date = new Date(expense.spent_on); return date.getUTCFullYear() === year && (month === 0 || date.getUTCMonth() + 1 === month); })
      : url.pathname === '/periodic-expenses' ? schedules
      : url.pathname === '/periodic-expenses/upcoming' ? { total_7: options.withRecurring ? 5 : 0, total_30: options.withRecurring ? 5 : 0, items: [] }
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

test('session flow restores protected navigation, profile changes, and logout', async ({ page }, testInfo) => {
  await mockApp(page, { startAnonymous: true });
  await page.goto('/categories');
  await expect(page).toHaveURL('http://localhost:3100/');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByPlaceholder('Username').fill('alex');
  await page.getByPlaceholder('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Invalid username or password')).toBeVisible();
  await page.getByPlaceholder('Password', { exact: true }).fill('correct');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Total Balance')).toBeVisible();
  await page.goto('/profile');
  await page.getByLabel('Username').fill('alex-updated');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('link', { name: 'alex-updated' })).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
});

test('expired sessions return to login and registration handles conflicts', async ({ page }) => {
  await mockApp(page, { startToken: 'expired' });
  await page.goto('/search');
  await expect(page).toHaveURL('http://localhost:3100/');
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  await page.getByRole('button', { name: "Don't have an account?" }).click();
  await page.getByPlaceholder('Username').fill('taken');
  await page.getByPlaceholder('Password', { exact: true }).fill('test-password');
  await page.getByPlaceholder('Confirm Password').fill('test-password');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Username is already taken')).toBeVisible();
  await page.getByPlaceholder('Username').fill('new-account');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Total Balance')).toBeVisible();
});

test('category form creates and edits a category with keyboard navigation', async ({ page }) => {
  await mockApp(page);
  await page.goto('/categories');
  await page.getByLabel('Category Name').fill('Groceries');
  await page.getByRole('button', { name: 'Add Category' }).click();
  const category = page.getByRole('button', { name: /Groceries/ });
  await expect(category).toBeVisible();
  await category.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Category Name')).toHaveValue('Groceries');
  await page.getByLabel('Category Name').fill('Food');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('button', { name: /Food/ })).toBeVisible();
});

test('category quick-add keeps its selection and input after a failed save', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true, failFirstExpenseSave: true });
  await page.goto('/?month=2024-02');
  await page.getByText('Food', { exact: true }).click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  const editor = page.getByRole('dialog', { name: 'New Record' });
  await expect(editor.getByRole('combobox', { name: 'Category' })).toHaveValue('1');
  await expect(editor.getByLabel('Date & Time')).toHaveValue('2024-02-01T12:00');
  await editor.getByLabel('Amount').fill('12,50');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByLabel('Amount')).toHaveValue('12,50');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog', { name: 'Details for Food' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Details for Food' }).getByText(/12\.50/)).toBeVisible();
});

test('recurring controls refresh after pause and resume', async ({ page }) => {
  await mockApp(page, { withRecurring: true });
  await page.goto('/periodic');
  await expect(page.getByRole('button', { name: /Daily coffee/ })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('analytics category links retain the selected month in search', async ({ page }) => {
  await mockApp(page, { withChartData: true });
  await page.goto('/analytics?month=2025-12');
  await page.getByRole('link', { name: '🍴 Food' }).click();
  await expect(page).toHaveURL(/category_id=1/);
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2025-12-01');
  await expect(page.getByLabel('To (inclusive)')).toHaveValue('2025-12-31');
});
