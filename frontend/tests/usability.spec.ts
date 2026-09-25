import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const api = 'http://localhost:8198';
async function setup(page:Page, request:APIRequestContext) {
  const response = await request.post(api + '/users', { data:{ username:'browser_' + Date.now() + '_' + Math.random().toString(36).slice(2), password:'test-password-123' } });
  expect(response.ok()).toBeTruthy();
  const { token } = await response.json();
  const headers = { Authorization:'Bearer ' + token };
  const categories:Record<string,number> = {};
  for (const name of ['Zulu','Food','Apple']) {
    const res = await request.post(api + '/categories', { headers, data:{ name, emoji:'🍴', type:'expense' } });
    expect(res.ok()).toBeTruthy(); categories[name] = (await res.json()).id;
  }
  await page.addInitScript(token => { localStorage.setItem('auth_token',token); localStorage.setItem('app_language','en'); }, token);
  return { token, headers, categories };
}
async function expense(request:APIRequestContext, headers:Record<string,string>, category:number, date:string, description = 'Dinner') {
  const response = await request.post(api + '/expenses', { headers, data:{ name:'Food', amount:20, category_id:category, spent_on:date, description } });
  expect(response.ok()).toBeTruthy();
}
async function nav(page:Page, name:string) {
  const link = page.getByRole('link',{ name, exact:true });
  if (!await link.isVisible()) await page.getByRole('button',{ name:'☰' }).click();
  const target = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(new RegExp(target! + "(?:\\?|$)"));
}

test('search finds old transactions and preserves filters through analytics and Back', async ({page,request}) => {
  const {headers,categories} = await setup(page,request);
  await expense(request,headers,categories.Food,'2023-01-01T12:00:00Z','Historic needle');
  for (let i=0;i<110;i++) await expense(request,headers,categories.Food,new Date(Date.UTC(2024,0,1+i,12)).toISOString(),'Recent transaction');
  await page.goto('/search');
  await page.getByRole('searchbox').fill('Historic needle');
  await expect(page.getByText('1 results found')).toBeVisible();
  await expect(page.getByRole('button',{name:/Historic needle/})).toBeVisible();
  await nav(page,'Analytics');
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('Historic needle');
  await expect(page.getByRole('button',{name:/Historic needle/})).toBeVisible();
});

test('category quick-add selects category and historical date; failed saves retain input', async ({page,request}) => {
  const {headers,categories} = await setup(page,request);
  await expense(request,headers,categories.Food,'2024-02-15T12:00:00Z');
  await page.goto('/?month=2024-02');
  await page.getByText('Food',{exact:true}).click();
  await page.getByRole('button',{name:'Add expense',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'New Record'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox',{name:'Category',exact:true})).toHaveValue(String(categories.Food));
  await expect(dialog.getByLabel('Date & Time')).toHaveValue('2024-02-01T12:00');
  await expect(dialog.getByLabel('Amount',{exact:true})).toBeFocused();
  await page.screenshot({ path:test.info().outputPath('category-entry.png') });
  const options = await dialog.getByRole('combobox',{name:'Category',exact:true}).locator('option').allTextContents();
  expect(options.slice(1)).toEqual(['🍴 Apple','🍴 Food','🍴 Zulu']);
  await dialog.getByLabel('Amount',{exact:true}).fill('12,50');
  let fail = true;
  let posts = 0;
  await page.route(api + '/expenses', async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    posts++;
    if (fail) await route.fulfill({status:500,body:'unavailable'}); else await route.continue();
  });
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Amount',{exact:true})).toHaveValue('12,50');
  fail=false;
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Details for Food'})).toBeVisible();
  expect(posts).toBe(2);
  await expect(page.getByRole('dialog').getByText(/12.50/)).toBeVisible();
  await page.getByRole('dialog',{name:'Details for Food'}).getByRole('button',{name:'Close'}).click();
  await page.getByRole('button',{name:'Year',exact:true}).click();
  await page.getByText('Food',{exact:true}).click();
  await page.getByRole('button',{name:'Add expense',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'New Record'}).getByLabel('Date & Time')).toHaveValue('2024-01-01T12:00');
});

test('dirty form cannot be accidentally dismissed; validation and keyboard cancellation work', async ({page,request}) => {
  await setup(page,request);
  await page.goto('/');
  await page.getByRole('button',{name:'New Record'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Amount',{exact:true}).fill('-1');
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog.getByText('Enter an amount greater than zero.')).toBeVisible();
  page.once('dialog',prompt => prompt.dismiss());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  page.once('dialog',prompt => prompt.accept());
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).not.toBeVisible();
});

test('month navigation crosses years and analytics links open filtered search', async ({page,request}) => {
  const {headers,categories}=await setup(page,request);
  await expense(request,headers,categories.Food,'2025-12-15T12:00:00Z');
  await page.goto('/?month=2026-01');
  await page.getByRole('button',{name:'Previous month'}).click();
  await expect(page).toHaveURL(/month=2025-12/);
  await nav(page,'Analytics');
  await expect(page.getByRole('link',{name:'🍴 Food',exact:true})).toBeVisible();
  await expect(page.locator('.recharts-sector')).toHaveCount(1);
  await page.screenshot({ path:test.info().outputPath('analytics.png'), fullPage:true });
  await page.getByRole('link',{name:'🍴 Food',exact:true}).click();
  await expect(page).toHaveURL(/category_id=/);
  await expect(page.getByLabel('From',{exact:true})).toHaveValue('2025-12-01');
  await expect(page.getByLabel('To (inclusive)')).toHaveValue('2025-12-31');
  await expect(page.getByRole('button',{name:/Dinner/})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link',{name:'🍴 Food',exact:true})).toBeVisible();
});

test('recurring edit preserves due date and supports pause, resume, and skip', async ({page,request}) => {
  const {headers,categories}=await setup(page,request);
  const date = new Date(); date.setUTCDate(date.getUTCDate()+1); date.setUTCHours(12,0,0,0);
  const response=await request.post(api+'/periodic-expenses',{headers,data:{
    name:'Daily coffee',amount:5,category_id:categories.Food,period_interval:1,period_unit:'days',start_date:date.toISOString(),
  }});
  expect(response.ok()).toBeTruthy();
  const schedule=await response.json();
  await page.goto('/periodic');
  await page.getByRole('button',{name:/Daily coffee/}).click();
  const dialog=page.getByRole('dialog',{name:'Edit recurring expense'});
  await dialog.getByLabel('Amount',{exact:true}).fill('7');
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  let list=await (await request.get(api+'/periodic-expenses',{headers})).json();
  expect(list[0].next_due_date).toBe(schedule.next_due_date);
  expect(list[0].amount).toBe(7);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  page.once('dialog',prompt => prompt.accept());
  await page.getByRole('button',{name:'Skip next',exact:true}).click();
  await expect(page.getByRole('button',{name:'Skip next',exact:true})).toBeEnabled();
  list=await (await request.get(api+'/periodic-expenses',{headers})).json();
  expect(new Date(list[0].next_due_date).getTime()).toBe(date.getTime()+86400000);
});

test('stale search responses cannot replace newer results', async ({page,request}) => {
  const {headers,categories}=await setup(page,request);
  await expense(request,headers,categories.Food,'2025-01-01T12:00:00Z','Apple dinner');
  await expense(request,headers,categories.Food,'2025-01-02T12:00:00Z','Banana dinner');
  await page.goto('/search');
  await expect(page.getByText('2 results found')).toBeVisible();
  await page.route(api + '/transactions/search?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q')==='Apple') {
      await new Promise(resolve=>setTimeout(resolve,800));
      try { await route.continue(); } catch {}
    } else await route.continue();
  });
  await page.getByRole('searchbox').fill('Apple');
  await page.waitForRequest(req=>req.url().includes('q=Apple'));
  await page.getByRole('searchbox').fill('Banana');
  await expect(page.getByRole('button',{name:/Banana dinner/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Apple dinner/})).not.toBeVisible();
});

