import type { Page } from '@playwright/test';

export async function mockApp(page: Page, options: { username?: string; isAdmin?: boolean; withChartData?: boolean; startAnonymous?: boolean; startToken?: string; withDashboardExpense?: boolean; failFirstExpenseSave?: boolean; withRecurring?: boolean; withDuplicateReview?: boolean; failFirstConfirmation?: boolean } = {}) {
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
