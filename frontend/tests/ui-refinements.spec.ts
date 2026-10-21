import { expect, test, type Page } from '@playwright/test';

async function mockApp(page: Page, options: { username?: string; isAdmin?: boolean; withChartData?: boolean; startAnonymous?: boolean; startToken?: string; withDashboardExpense?: boolean; failFirstExpenseSave?: boolean; withRecurring?: boolean; withDuplicateReview?: boolean; failFirstConfirmation?: boolean } = {}) {
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
  let duplicateConfirmations = 0;
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
      const body = route.request().postDataJSON() as Omit<(typeof expenses)[number], 'id'> & { allow_duplicate?: boolean };
      if (options.withDuplicateReview && !body.allow_duplicate && body.amount === 20) {
        return route.fulfill({ status: 409, headers, json: {
          code: 'possible_duplicate', total: 7,
          matches: Array.from({ length: 5 }, (_, index) => ({
            id: 100 + index, name: 'Legacy payment', description: index === 1 ? '' : `Saved dinner ${index + 1}`,
            amount: 20, category_id: 1, category_name: index === 1 ? 'Utilities' : 'Food', category_emoji: '🍴',
            spent_on: body.spent_on, is_periodic: index === 1,
          })),
        } });
      }
      if (options.withDuplicateReview && body.allow_duplicate) {
        duplicateConfirmations++;
        if (options.failFirstConfirmation && duplicateConfirmations === 1) return route.fulfill({ status: 500, body: 'unavailable', headers });
      }
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

for (const language of ['en', 'it'] as const) {
  test(`dashboard formats large financial values consistently without splitting currency (${language})`, async ({ page }) => {
    await mockApp(page, { withDashboardExpense: true });
    await page.addInitScript(language => localStorage.setItem('app_language', language), language);
    await page.route('**/expenses/filter?*', route => route.fulfill({ json: [
      { id: 1, name: 'Food', amount: 1234567.89, description: 'Large expense', category_id: 1, spent_on: '2024-02-15T12:00:00Z' },
    ], headers: { 'access-control-allow-origin': '*' } }));
    await page.goto('/?month=2024-02');
    const amounts = page.locator('.money');
    await expect(amounts.first()).toContainText(language === 'it' ? '-1.234.567,89' : '-€1,234,567.89');
    await expect(amounts.first()).toHaveCSS('white-space', 'nowrap');
    await page.getByRole('button', { name: /Food/ }).click();
    await expect(page.getByRole('dialog').locator('.money')).toContainText(language === 'it' ? '-1.234.567,89' : '-€1,234,567.89');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`subtle motion preserves interaction and honors preferences (${reducedMotion}, ${theme})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await mockApp(page, { withDashboardExpense: true });
      await page.addInitScript(theme => {
        localStorage.setItem('app_theme_active_user', '1');
        localStorage.setItem('app_theme:1', theme);
      }, theme);
      await page.goto('/?month=2024-02');
      const year = page.getByRole('button', { name: 'Year', exact: true });
      await year.focus();
      await page.keyboard.down('Space');
      try {
        if (reducedMotion === 'reduce') await expect(year).toHaveCSS('transform', 'none');
        else await expect.poll(() => year.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a)).toBeLessThan(1);
      } finally { await page.keyboard.up('Space'); }
      await expect(year).toHaveAttribute('aria-pressed', 'true');
      const add = page.getByRole('button', { name: 'New expense', exact: true });
      if (reducedMotion === 'reduce') {
        for (const button of [add, year, page.getByRole('button', { name: 'Incomes', exact: true }), page.getByRole('button', { name: /Choose year:/ })]) {
          expect(await button.evaluate(element => getComputedStyle(element).transitionDuration.split(',').every(duration => parseFloat(duration) === 0))).toBe(true);
        }
      }
      await add.click();
      const editor = page.getByRole('dialog', { name: 'New Record' });
      const amount = editor.getByLabel('Amount', { exact: true });
      await expect(amount).toBeFocused();
      const motion = await editor.evaluate(element => ({
        duration: parseFloat(getComputedStyle(element).animationDuration),
        name: getComputedStyle(element).animationName,
        backdrop: getComputedStyle(element, '::backdrop').animationName,
      }));
      if (reducedMotion === 'reduce') {
        expect(motion.name).toBe('none');
        expect(motion.backdrop).toBe('none');
      } else {
        expect(motion.name).not.toBe('none');
        expect(motion.backdrop).not.toBe('none');
        expect(motion.duration).toBeGreaterThan(0);
        expect(motion.duration).toBeLessThanOrEqual(.2);
      }
      await editor.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
      await expect(editor).toHaveCSS('opacity', '1');
      await expect(editor).toHaveCSS('transform', 'none');
      await amount.fill('12.50');
      expect(await editor.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running'))).toBe(false);
      page.once('dialog', prompt => prompt.dismiss());
      await editor.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(amount).toHaveValue('12.50');
      page.once('dialog', prompt => prompt.accept());
      await page.keyboard.press('Escape');
      await expect(editor).toHaveCount(0);
      await expect(add).toBeFocused();
      await add.click();
      await expect(amount).toBeFocused();
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(editor).toHaveCount(0);

      await page.goto('/profile');
      const card = page.locator('.glass-container');
      await card.hover();
      await expect(card).toHaveCSS('transform', 'none');
      if (reducedMotion === 'reduce') {
        expect(await page.getByRole('group', { name: 'Theme', exact: true }).getByRole('button').evaluateAll(buttons => buttons.every(button => getComputedStyle(button).transitionDuration.split(',').every(duration => parseFloat(duration) === 0)))).toBe(true);
      }
      const passwordBounds = await page.getByLabel('Password', { exact: true }).boundingBox();
      const toggleBounds = await page.getByRole('button', { name: 'Show password', exact: true }).boundingBox();
      expect(passwordBounds && toggleBounds).toBeTruthy();
      expect(Math.abs(passwordBounds!.y + passwordBounds!.height / 2 - (toggleBounds!.y + toggleBounds!.height / 2))).toBeLessThan(1);
    });
  }
}

test('large analytics values remain inside summary cards on narrow screens', async ({ page }) => {
  await mockApp(page, { withChartData: true });
  await page.addInitScript(() => localStorage.setItem('app_language', 'it'));
  await page.route('**/analytics/expenses-by-category?*', route => route.fulfill({ json: [{ category_id: 1, total_amount: 1234567.89 }], headers: { 'access-control-allow-origin': '*' } }));
  await page.route('**/analytics/income-vs-expense?*', route => route.fulfill({ json: {
    incomes: [{ year: 2024, month: 2, total_amount: 2469135.78 }], expenses: [{ year: 2024, month: 2, total_amount: 1234567.89 }],
  }, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/analytics?month=2024-02');
  const summaries = page.locator('.analytics-summary .money');
  await expect(summaries).toHaveCount(4);
  await expect(summaries.first()).toContainText('2.469.135,78');
  expect(await summaries.evaluateAll(values => values.every(value => value.scrollWidth <= value.clientWidth))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('category overview puts the largest totals first with one decimal percentage', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.route('**/categories', route => route.fulfill({ json: [
    { id: 1, name: 'Food', type: 'expense' }, { id: 2, name: 'Rent', type: 'expense' }, { id: 3, name: 'Zoo', type: 'expense' },
  ], headers: { 'access-control-allow-origin': '*' } }));
  await page.route('**/expenses/filter?*', route => route.fulfill({ json: [
    { id: 1, name: 'Food', amount: 300, category_id: 1, spent_on: '2024-02-15T12:00:00Z' },
    { id: 2, name: 'Rent', amount: 500, category_id: 2, spent_on: '2024-02-15T12:00:00Z' },
    { id: 3, name: 'Zoo', amount: 300, category_id: 3, spent_on: '2024-02-15T12:00:00Z' },
  ], headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/?month=2024-02');
  const rows = page.locator('.list-container > button');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Rent');
  await expect(rows.nth(0)).toContainText('45.5 % of total');
  await expect(rows.nth(1)).toContainText('Food');
  await expect(rows.nth(2)).toContainText('Zoo');
  await expect(rows.nth(0).locator('[class*="progressFill"]')).toHaveJSProperty('offsetHeight', 6);
});

test('empty dashboard guides category creation and keeps income actions relevant', async ({ page }) => {
  await mockApp(page);
  await page.goto('/?month=2024-02');
  await expect(page.getByRole('heading', { name: 'No expenses in this period' })).toBeVisible();
  await page.getByRole('link', { name: 'New Category' }).click();
  await expect(page).toHaveURL(/categories\?new=expense/);
  await page.route('**/categories', route => route.fulfill({ json: [
    { id: 2, name: 'Salary', type: 'income' },
  ], headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'Incomes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No income in this period' })).toBeVisible();
  await page.getByRole('button', { name: 'Add income', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Type')).toHaveValue('income');
});

test('login keeps labels visible and links errors to fields with comfortable password controls', async ({ page }) => {
  await mockApp(page, { startAnonymous: true });
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('alex');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await expect(page.locator('label[for="auth-password"]')).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Show password', exact: true });
  const size = await toggle.boundingBox();
  expect(size && size.width >= 44 && size.height >= 44).toBeTruthy();
  await toggle.click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-describedby', 'auth-error');
  await expect(page.locator('form').getByRole('alert')).toHaveText('Invalid username or password');
  await page.getByRole('button', { name: "Don't have an account?" }).click();
  await page.getByLabel('Password', { exact: true }).fill('correct');
  await page.getByLabel('Confirm Password', { exact: true }).fill('mismatch');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Confirm Password')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Confirm Password')).toHaveAttribute('aria-describedby', 'auth-error');
});

for (const language of ['en', 'it'] as const) {
  test(`details omit cancel and editor actions share a row with protected dismissal (${language})`, async ({ page }) => {
    await mockApp(page, { withDashboardExpense: true });
    await page.addInitScript(language => localStorage.setItem('app_language', language), language);
    const italian = language === 'it';
    await page.goto('/?month=2024-02');
    await page.getByRole('button', { name: /Food/ }).click();
    const details = page.getByRole('dialog', { name: italian ? 'Dettagli per Food' : 'Details for Food' });
    await expect(details.getByRole('button', { name: italian ? 'Annulla' : 'Cancel', exact: true })).toHaveCount(0);
    await details.getByRole('button', { name: italian ? 'Chiudi' : 'Close', exact: true }).click();
    await expect(details).toBeHidden();
    await page.getByRole('button', { name: /Food/ }).click();

    for (const action of ['cancel', 'close', 'escape']) {
      await details.getByRole('button', { name: /Dinner/ }).click();
      const editor = page.getByRole('dialog', { name: italian ? 'Modifica Registrazione' : 'Edit Record' });
      const cancel = editor.getByRole('button', { name: italian ? 'Annulla' : 'Cancel', exact: true });
      const save = editor.getByRole('button', { name: italian ? 'Salva' : 'Save', exact: true });
      const cancelBounds = await cancel.boundingBox();
      const saveBounds = await save.boundingBox();
      expect(cancelBounds && saveBounds).toBeTruthy();
      expect(Math.abs(cancelBounds!.y - saveBounds!.y)).toBeLessThan(1);
      expect(Math.abs(cancelBounds!.height - saveBounds!.height)).toBeLessThan(1);
      expect(saveBounds!.x).toBeGreaterThan(cancelBounds!.x);
      expect(cancelBounds!.height).toBeGreaterThanOrEqual(48);
      const amount = editor.getByLabel(italian ? 'Importo' : 'Amount', { exact: true });
      await amount.fill('21');
      if (action === 'cancel') await page.screenshot({ path: test.info().outputPath(`editor-actions-${language}.png`), fullPage: true });
      const dismiss = () => action === 'escape' ? page.keyboard.press('Escape') : editor.getByRole('button', { name: action === 'cancel' ? (italian ? 'Annulla' : 'Cancel') : (italian ? 'Chiudi' : 'Close'), exact: true }).click();
      page.once('dialog', prompt => prompt.dismiss());
      await dismiss();
      await expect(editor).toBeVisible();
      await expect(amount).toHaveValue('21');
      page.once('dialog', prompt => prompt.accept());
      await dismiss();
      await expect(editor).toBeHidden();
      await expect(details).toBeVisible();
      await expect(details.locator('.money')).toContainText(italian ? '20,00' : '20.00');
    }
  });
}

test('transaction validation focuses the first error and describes each invalid field', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByLabel('Amount', { exact: true })).toBeFocused();
  await expect(editor.getByLabel('Amount', { exact: true })).toHaveAttribute('aria-describedby', 'amount-error');
  await expect(editor.getByRole('combobox', { name: 'Category', exact: true })).toHaveAttribute('aria-describedby', 'category-error');
  for (const control of [editor.getByRole('button', { name: 'Close', exact: true })]) {
    const size = await control.boundingBox();
    expect(size && size.width >= 44 && size.height >= 44).toBeTruthy();
  }
});

for (const language of ['en', 'it'] as const) {
  test(`dashboard makes the period mode and new transaction type explicit (${language})`, async ({ page }) => {
    await mockApp(page, { withDashboardExpense: true });
    await page.addInitScript(language => {
      localStorage.setItem('app_language', language);
      if (language === 'it') {
        localStorage.setItem('app_theme_active_user', '1');
        localStorage.setItem('app_theme:1', 'dark');
      }
    }, language);
    const italian = language === 'it';
    await page.goto('/?month=2024-03');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const controls = page.getByRole('region', { name: italian ? 'Periodo' : 'Period', exact: true });
    const modes = controls.getByRole('group', { name: italian ? 'Vista del periodo' : 'Period view' });
    const month = modes.getByRole('button', { name: italian ? 'Mese' : 'Month', exact: true });
    const year = modes.getByRole('button', { name: italian ? 'Anno' : 'Year', exact: true });
    const balance = page.getByRole('heading', { name: italian ? 'Saldo del periodo' : 'Period balance', exact: true }).locator('..').locator('.money').first();
    await expect(month).toHaveAttribute('aria-pressed', 'true');
    await expect(year).toHaveAttribute('aria-pressed', 'false');
    await expect(balance).toContainText(italian ? '0,00' : '€0.00');
    await year.focus();
    await page.keyboard.press('Enter');
    await expect(year).toHaveAttribute('aria-pressed', 'true');
    await expect(month).toHaveAttribute('aria-pressed', 'false');
    await expect(controls.getByRole('button', { name: italian ? /Scegli anno:/ : /Choose year:/ })).toBeVisible();
    await expect(balance).toContainText(italian ? '-20,00' : '-€20.00');
    await year.click();
    await expect(year).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: test.info().outputPath(`dashboard-controls-${language}.png`), fullPage: true });
    await month.click();
    await expect(month).toHaveAttribute('aria-pressed', 'true');
    await expect(balance).toContainText(italian ? '0,00' : '€0.00');
    await expect(page).toHaveURL(/month=2024-03/);

    await page.getByRole('button', { name: italian ? 'Nuova spesa' : 'New expense', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('combobox', { name: italian ? 'Tipo' : 'Type', exact: true })).toHaveValue('expense');
    await page.getByRole('dialog').getByRole('button', { name: italian ? 'Annulla' : 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: italian ? 'Entrate' : 'Incomes', exact: true }).click();
    await expect(page.getByRole('button', { name: italian ? 'Nuova spesa' : 'New expense', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: italian ? 'Nuova entrata' : 'New income', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('combobox', { name: italian ? 'Tipo' : 'Type', exact: true })).toHaveValue('income');
    await page.getByRole('dialog').getByRole('button', { name: italian ? 'Annulla' : 'Cancel', exact: true }).click();
    for (const width of [320, 393, 600, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: italian ? 'Nuova entrata' : 'New income', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
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
  const yearButton = page.getByRole('button', { name: 'Year', exact: true });
  await expect(yearButton).toHaveCSS('border-radius', '12px');
  await yearButton.click();
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

test('collapsed search exposes applied filters and removes criteria without losing the query', async ({ page }, testInfo) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.goto('/search?q=coffee&type=expense&category_id=1&from=2024-02-01&to=2024-02-29&min_amount=10.50&max_amount=100&offset=50');
  await expect(page.getByText('0 results found')).toBeVisible();
  const chips = page.getByRole('list', { name: 'Applied filters' });
  if (testInfo.project.name === 'mobile') {
    await expect(chips).toBeVisible();
    await expect(chips.getByRole('button', { name: 'Remove Category: Food' })).toBeVisible();
    await chips.getByRole('button', { name: 'Remove From: 01/02/2024' }).click();
    await expect(page.getByRole('button', { name: 'Show filters 5' })).toHaveAttribute('aria-expanded', 'false');
    const params = new URL(page.url()).searchParams;
    expect(params.has('from')).toBe(false);
    expect(params.has('offset')).toBe(false);
    expect(params.get('q')).toBe('coffee');
    expect(params.get('category_id')).toBe('1');
    expect(params.get('to')).toBe('2024-02-29');
    await page.screenshot({ path: test.info().outputPath('search-filter-chips.png'), fullPage: true });
  } else {
    await expect(chips).toBeHidden();
  }
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(chips).toHaveCount(0);
});

test('profile translates its settings help and deletion instructions in both languages', async ({ page }) => {
  await mockApp(page);
  await page.goto('/profile');
  for (const italian of [false, true]) {
    if (italian) await page.getByRole('button', { name: 'Italiano', exact: true }).click();
    await expect(page.getByText(italian ? 'Aggiorna le tue informazioni e preferenze.' : 'Update your information and preferences.')).toBeVisible();
    await expect(page.getByPlaceholder(italian ? 'Nuova password' : 'New password')).toBeVisible();
    await expect(page.getByRole('heading', { name: italian ? 'Zona pericolosa' : 'Danger zone' })).toBeVisible();
    await expect(page.getByRole('group', { name: italian ? 'Lingua' : 'Language', exact: true }).getByRole('button', { name: italian ? 'Italiano' : 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: italian ? 'Elimina Account' : 'Delete Account', exact: true }).click();
    const editor = page.getByRole('dialog');
    await expect(editor.getByText(italian ? 'Digita "elimina il mio account" per confermare:' : 'Type "delete my account" to confirm:')).toBeVisible();
    await expect(editor.getByLabel(italian ? 'Frase di conferma' : 'Confirmation phrase', { exact: true })).toHaveAttribute('aria-describedby', 'profile-delete-instructions');
    await editor.getByRole('button', { name: italian ? 'Annulla' : 'Cancel', exact: true }).click();
  }
  await page.screenshot({ path: test.info().outputPath('profile-translated.png'), fullPage: true });
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
  if (test.info().project.name === 'mobile') await page.getByRole('button', { name: 'More', exact: true }).click();
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
    ['/', 'Period balance', 'dashboard'],
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

for (const language of ['en', 'it'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`bottom navigation opens each destination and restores focus (${language}, ${theme})`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile');
      await mockApp(page, { isAdmin: true, withDashboardExpense: true, withChartData: true, withRecurring: true });
      await page.addInitScript(({ language, theme }) => {
        localStorage.setItem('app_language', language);
        localStorage.setItem('app_theme_active_user', '1');
        localStorage.setItem('app_theme:1', theme);
      }, { language, theme });
      await page.goto('/?month=2024-02');
      const italian = language === 'it';
      const nav = page.getByRole('navigation', { name: italian ? 'Navigazione principale' : 'Main navigation' });
      const more = nav.getByRole('button', { name: italian ? 'Altro' : 'More', exact: true });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link')).toHaveCount(4);
      await expect(page.getByRole('button', { name: /Open menu|Apri menu/ })).toHaveCount(0);
      for (const target of await nav.locator('a, button').all()) {
        const bounds = await target.boundingBox();
        expect(bounds && bounds.width >= 44 && bounds.height >= 44).toBeTruthy();
        await expect(target.locator('span')).toBeVisible();
      }
      await page.screenshot({ path: testInfo.outputPath(`bottom-navigation-${language}-${theme}.png`) });
      for (const [label, route] of [
        [italian ? 'Cerca' : 'Search', '/search'],
        [italian ? 'Analisi' : 'Analytics', '/analytics'],
        [italian ? 'Periodiche' : 'Recurring', '/periodic'],
        ['Home', '/'],
      ]) {
        await nav.getByRole('link', { name: label, exact: true }).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(route);
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(nav.locator('[aria-current]')).toHaveCount(1);
      }
      await more.focus();
      await page.keyboard.press('Enter');
      const panel = page.getByRole('dialog', { name: italian ? 'Altro' : 'More', exact: true });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('button', { name: italian ? 'Chiudi' : 'Close', exact: true })).toBeFocused();
      await panel.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)); });
      await page.screenshot({ path: testInfo.outputPath(`more-navigation-${language}-${theme}.png`) });
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(more).toBeFocused();
      await more.click();
      await panel.getByRole('link', { name: italian ? 'Categorie' : 'Categories', exact: true }).click();
      await expect(page).toHaveURL(/\/categories$/);
      await expect(panel).toHaveCount(0);
      await expect(more).toHaveAttribute('aria-current', 'true');
      await page.goBack();
      await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(more).not.toHaveAttribute('aria-current');
      await more.click();
      await panel.getByRole('link', { name: italian ? 'Pannello Admin' : 'Admin Panel', exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await more.click();
      await panel.getByRole('link', { name: /ui-test/ }).click();
      await expect(page).toHaveURL(/\/profile$/);
      await more.click();
      await panel.getByRole('button', { name: italian ? 'Esci' : 'Logout', exact: true }).click();
      await expect(page.getByRole('heading', { name: italian ? 'Accedi' : 'Login', exact: true })).toBeVisible();
      await expect(nav).toHaveCount(0);
    });
  }
}

test('bottom navigation leaves final controls reachable and closes its panel on desktop resize', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await mockApp(page, { withDashboardExpense: true });
  for (const width of [320, 390, 768, 1023]) {
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/profile');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const lastAction = page.getByRole('button', { name: 'Delete Account', exact: true });
    await lastAction.scrollIntoViewIfNeeded();
    const navBounds = await nav.boundingBox();
    const actionBounds = await lastAction.boundingBox();
    expect(navBounds && actionBounds && actionBounds.y + actionBounds.height < navBounds.y).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await lastAction.click();
    const confirmation = page.getByRole('dialog', { name: 'Delete Account', exact: true });
    await expect(confirmation.getByLabel('Confirmation phrase', { exact: true })).toBeFocused();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'More', exact: true });
    await expect(panel.getByRole('link', { name: 'Admin Panel', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Logout', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 600 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
});

test('navbar keeps account destinations reachable at tablet and desktop widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await mockApp(page, { username: 'very-long-account-name-that-must-not-hide-logout', isAdmin: true });
  await page.goto('/');
  for (const language of ['en', 'it']) {
    await page.evaluate(value => localStorage.setItem('app_language', value), language);
    for (const width of [768, 769, 1023, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      if (width < 1024) await page.getByRole('button', { name: language === 'it' ? 'Altro' : 'More', exact: true }).click();
      const logout = page.getByRole('button', { name: language === 'it' ? 'Esci' : 'Logout' });
      await expect(logout).toBeVisible();
      const bounds = await logout.boundingBox();
      expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width).toBeTruthy();
      const profileBounds = await page.getByRole('link', { name: /very-long-account-name-that-must-not-hide-logout/ }).boundingBox();
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
  await expect(page.getByText('Period balance')).toBeVisible();
  await page.goto('/profile');
  await page.getByLabel('Username').fill('alex-updated');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('link', { name: /alex-updated/ })).toBeVisible();
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
  await expect(page.getByText('Period balance')).toBeVisible();
});

test('category form creates and edits a category with keyboard navigation', async ({ page }) => {
  await mockApp(page);
  await page.goto('/categories');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'New Category', exact: true }).click();
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

test('category management starts with the list and preserves failed or unsaved edits', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true });
  await page.goto('/categories');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Food/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('categories-list.png'), fullPage: true });
  await page.getByRole('button', { name: /Food/ }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Category' });
  await editor.getByLabel('Category Name').fill('');
  await editor.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editor.getByLabel('Category Name')).toBeFocused();
  await expect(editor.getByLabel('Category Name')).toHaveAttribute('aria-describedby', 'category-name-error');
  await editor.getByLabel('Category Name').fill('Groceries');
  await page.route('**/categories/1', route => route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'unavailable' }));
  await editor.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByLabel('Category Name')).toHaveValue('Groceries');
  await page.screenshot({ path: test.info().outputPath('category-editor.png'), fullPage: true });
  page.once('dialog', dialog => dialog.dismiss());
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toBeHidden();
  await page.goto('/categories?new=income');
  await expect(page.getByRole('radio', { name: 'Income', exact: true })).toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/categories$/);
});

test('category quick-add keeps its selection and input after a failed save', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true, failFirstExpenseSave: true });
  await page.goto('/?month=2024-02');
  await page.getByText('Food', { exact: true }).click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  const editor = page.getByRole('dialog', { name: 'New Record' });
  await expect(editor.getByRole('combobox', { name: 'Category' })).toHaveValue('1');
  await expect(editor.getByLabel('Date & Time')).toHaveValue('2024-02-01T12:00');
  await expect(editor.locator('#transaction-period-notice')).toHaveCount(0);
  await editor.getByLabel('Amount').fill('12,50');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByLabel('Amount')).toHaveValue('12,50');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog', { name: 'Details for Food' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Details for Food' }).getByText(/12\.50/)).toBeVisible();
});

test.describe('dashboard transaction period notice', () => {
  test.use({ timezoneId: 'Europe/Rome' });

  for (const language of ['en', 'it'] as const) {
    test(`explains dates outside a historical month and confirms where they were saved (${language})`, async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-19T10:00:00Z'));
      await mockApp(page, { withDashboardExpense: true });
      await page.addInitScript(language => localStorage.setItem('app_language', language), language);
      const italian = language === 'it';
      await page.goto('/?month=2024-02');
      await page.getByRole('button', { name: italian ? 'Nuova spesa' : 'New expense', exact: true }).click();
      const editor = page.getByRole('dialog');
      const date = editor.getByLabel(italian ? 'Data e Ora' : 'Date & Time');
      const notice = editor.locator('#transaction-period-notice');
      await expect(date).toHaveValue('2026-10-19T12:00');
      await expect(notice).toContainText(italian ? 'febbraio 2024' : 'February 2024');
      await expect(notice).toContainText(italian ? 'ottobre 2026' : 'October 2026');
      await expect(date).toHaveAttribute('aria-describedby', 'transaction-period-notice');
      await date.fill('2024-02-12T12:00');
      await expect(notice).toHaveCount(0);
      await date.fill('2026-10-19T12:00');
      await expect(notice).toBeVisible();
      await editor.getByRole('checkbox', { name: italian ? 'Spesa Periodica' : 'Periodic Expense' }).check();
      await expect(notice).toHaveCount(0);
      await editor.getByRole('checkbox', { name: italian ? 'Spesa Periodica' : 'Periodic Expense' }).uncheck();
      await expect(notice).toBeVisible();
      await editor.getByLabel(italian ? 'Importo' : 'Amount', { exact: true }).fill('13');
      await editor.getByRole('combobox', { name: italian ? 'Categoria' : 'Category', exact: true }).selectOption('1');
      await editor.getByRole('button', { name: italian ? 'Salva' : 'Save', exact: true }).click();
      await expect(editor).toBeHidden();
      await expect(page).toHaveURL(/month=2024-02/);
      await expect(page.getByText(italian
        ? 'Registrazione salvata in ottobre 2026, fuori dal periodo visualizzato.'
        : 'Entry saved in October 2026, outside the viewed period.', { exact: true })).toBeVisible();
    });
  }

  test('uses ledger UTC boundaries for month and year notices', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T10:00:00Z'));
    await mockApp(page, { withDashboardExpense: true });
    await page.goto('/?month=2026-10');
    await page.getByRole('button', { name: 'New expense', exact: true }).click();
    let editor = page.getByRole('dialog');
    let date = editor.getByLabel('Date & Time');
    await expect(editor.locator('#transaction-period-notice')).toHaveCount(0);
    await date.fill('2026-10-01T00:30');
    await expect(editor.locator('#transaction-period-notice')).toContainText('September 2026');
    await date.fill('2026-10-01T02:30');
    await expect(editor.locator('#transaction-period-notice')).toHaveCount(0);
    await date.fill('');
    await expect(editor.locator('#transaction-period-notice')).toHaveCount(0);

    page.once('dialog', prompt => prompt.accept());
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto('/?month=2025-10');
    await page.getByRole('button', { name: 'Year', exact: true }).click();
    await page.getByRole('button', { name: 'New expense', exact: true }).click();
    editor = page.getByRole('dialog');
    date = editor.getByLabel('Date & Time');
    await expect(editor.locator('#transaction-period-notice')).toContainText("You're viewing 2025");
    await date.fill('2025-04-12T12:00');
    await expect(editor.locator('#transaction-period-notice')).toHaveCount(0);
    await date.fill('2026-01-01T00:30');
    await expect(editor.locator('#transaction-period-notice')).toHaveCount(0);
    await date.fill('2026-01-01T02:30');
    await expect(editor.locator('#transaction-period-notice')).toContainText('will appear in 2026');
  });
});

for (const language of ['en', 'it'] as const) {
  test(`duplicate review preserves the draft and explicitly confirms saving (${language})`, async ({ page }) => {
    await mockApp(page, { withDashboardExpense: true, withDuplicateReview: true, failFirstConfirmation: true });
    await page.addInitScript(language => {
      localStorage.setItem('app_language', language);
      if (language === 'it') {
        localStorage.setItem('app_theme_active_user', '1');
        localStorage.setItem('app_theme:1', 'dark');
      }
    }, language);
    const italian = language === 'it';
    await page.goto('/?month=2024-02');
    await page.getByRole('button', { name: italian ? 'Nuova spesa' : 'New expense', exact: true }).click();
    const editor = page.getByRole('dialog');
    const amount = italian ? 'Importo' : 'Amount';
    const description = italian ? 'Descrizione' : 'Description';
    const date = italian ? 'Data e Ora' : 'Date & Time';
    const save = italian ? 'Salva' : 'Save';
    await editor.getByLabel(amount, { exact: true }).fill('20,00');
    await editor.getByRole('combobox', { name: italian ? 'Categoria' : 'Category', exact: true }).selectOption('1');
    await editor.getByLabel(description, { exact: true }).fill('New dinner');
    await editor.getByLabel(date, { exact: true }).fill('2024-02-15T20:00');
    const requests: Record<string, unknown>[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/expenses' && request.method() === 'POST') requests.push(request.postDataJSON());
    });
    await editor.getByRole('button', { name: save, exact: true }).click();
    const heading = editor.getByRole('heading', { name: italian ? 'Possibile duplicato' : 'Possible duplicate' });
    await expect(heading).toBeVisible();
    await expect(editor.getByRole('button', { name: italian ? 'Annulla' : 'Cancel', exact: true })).toHaveCount(0);
    await expect(heading).toBeFocused();
    await page.keyboard.press('Enter');
    expect(requests).toHaveLength(1);
    await expect(editor.getByRole('listitem')).toHaveCount(5);
    await expect(editor.getByText('Utilities', { exact: false })).toBeVisible();
    await expect(editor.getByText('Legacy payment')).toBeVisible();
    await expect(editor.getByText(italian ? 'Spesa Periodica' : 'Periodic Expense', { exact: true })).toBeVisible();
    await expect(editor.getByText(italian ? 'Mostrate 5 di 7 possibili corrispondenze.' : 'Showing 5 of 7 possible matches.')).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].allow_duplicate).toBeUndefined();
    expect(requests[0].timezone).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath(`duplicate-review-${language}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await editor.getByRole('button', { name: italian ? 'Torna indietro' : 'Go back' }).click();
    await expect(editor.getByLabel(amount, { exact: true })).toBeFocused();
    await expect(editor.getByLabel(amount, { exact: true })).toHaveValue('20,00');
    await expect(editor.getByLabel(description, { exact: true })).toHaveValue('New dinner');
    await expect(editor.getByLabel(date, { exact: true })).toHaveValue('2024-02-15T20:00');
    expect(requests).toHaveLength(1);
    await editor.getByRole('button', { name: save, exact: true }).click();
    await expect(heading).toBeVisible();
    expect(requests[1].allow_duplicate).toBeUndefined();
    const confirm = editor.getByRole('button', { name: italian ? 'Salva comunque' : 'Save anyway' });
    await confirm.focus();
    await page.keyboard.press('Enter');
    await expect(editor.getByRole('alert')).toBeVisible();
    await expect(heading).toBeVisible();
    expect(requests[2]).toEqual({ ...requests[1], allow_duplicate: true });
    await confirm.click();
    await expect(editor).toBeHidden();
    expect(requests).toHaveLength(4);
    expect(requests[3]).toEqual(requests[2]);
  });
}

test('changing a reviewed expense checks the revised draft without an override', async ({ page }) => {
  await mockApp(page, { withDashboardExpense: true, withDuplicateReview: true });
  await page.goto('/?month=2024-02');
  await page.getByRole('button', { name: 'New expense', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Amount', { exact: true }).fill('20');
  await editor.getByRole('combobox', { name: 'Category', exact: true }).selectOption('1');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await editor.getByRole('button', { name: 'Go back' }).click();
  await editor.getByLabel('Amount', { exact: true }).fill('25');
  const request = page.waitForRequest(request => new URL(request.url()).pathname === '/expenses' && request.method() === 'POST');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await request).postDataJSON()).not.toHaveProperty('allow_duplicate');
  await expect(editor).toBeHidden();
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
  await expect(page.getByLabel('To (inclusive)', { exact: true })).toHaveValue('2025-12-31');
});
