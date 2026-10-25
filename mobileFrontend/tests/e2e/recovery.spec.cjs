const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { apiURL } = require('./settings.cjs');
const { business, signIn, tab, confirm, preparePage, activeText, rejectedSave } = require('./helpers.cjs');
test.beforeEach(preparePage);
async function newProfile(page, name) {
  await tab(page, 'Invoice');
  await page.getByRole('button', { name: 'Manage customer profiles' }).click();
  await page.getByRole('button', { name: 'Add customer' }).click();
  await page.getByLabel('Customer name, required', { exact: true }).fill(name);
}

test('login network errors allow retry and failed bootstrap does not expose authenticated data', async ({ page }) => {
  await page.route(`${apiURL}/auth/login`, route => route.abort('connectionfailed'), { times: 1 });
  await page.goto('/');
  const { username, password } = require('./settings.cjs');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(activeText(page, 'Cannot reach the server. Check your connection and try again.')).toBeVisible();
  await page.route(`${apiURL}/app-data`, route => route.abort('connectionfailed'), { times: 1 });
  const bootstrapFailure = page.waitForEvent('requestfailed', request => request.url() === `${apiURL}/app-data`);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await bootstrapFailure;
  await expect(activeText(page, 'Cannot reach the server. Check your connection and try again.')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Home/ })).not.toBeVisible();
  await signIn(page);
});

test('server-revoked sessions return to login and clear private screens', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page);
  const response = await request.post(`${apiURL}/auth/logout`, { headers: data.headers });
  expect(response.ok()).toBeTruthy();
  await tab(page, 'Profile');
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(activeText(page, 'Your session has expired. Please sign in again.')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Invoice/ })).not.toBeVisible();
});

for (const mode of ['uncertain response', 'refresh failure']) {
  test(`recover after ${mode} without duplicating a saved customer`, async ({ page, request }) => {
    const data = await business(request);
    await signIn(page);
    const name = `Recover ${randomUUID().slice(0, 8)}`;
    await newProfile(page, name);
    if (mode === 'uncertain response') {
      await page.route(`${apiURL}/customers`, async route => { await route.fetch(); await route.abort('connectionfailed'); }, { times: 1 });
    } else {
      await page.route(`${apiURL}/app-data`, route => route.abort('connectionfailed'), { times: 1 });
    }
    await rejectedSave(page, () => page.getByRole('button', { name: 'Save profile' }).click(), /saved|reach the server|Network Error/i);
    await expect(page.getByRole('heading', { name: 'Refresh business records' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save profile' })).not.toBeVisible();
    expect((await data.snapshot()).customers.filter(c => c.name === name)).toHaveLength(1);
    await page.route(`${apiURL}/app-data`, route => route.abort('connectionfailed'), { times: 1 });
    await page.getByRole('button', { name: 'Refresh records' }).click();
    await expect(activeText(page, 'Cannot reach the server. Please try again.')).toBeVisible();
    await page.getByRole('button', { name: 'Refresh records' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    expect((await data.snapshot()).customers.filter(c => c.name === name)).toHaveLength(1);
  });
}

test('duplicate submissions are rejected while the original save is still pending', async ({ page, request }) => {
  const data = await business(request); await signIn(page);
  const name = `Single save ${randomUUID().slice(0, 8)}`;
  await newProfile(page, name);
  let release, requests = 0;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(`${apiURL}/customers`, async route => { requests++; await held; await route.continue(); });
  try {
    await confirm(page, () => page.getByRole('button', { name: 'Save profile' }).click());
    await expect(activeText(page, 'Saving and refreshing records…')).toBeVisible();
    await expect.poll(() => requests).toBe(1);
    await rejectedSave(page, () => page.getByRole('button', { name: 'Save profile' }).click(), /Another request is still running/);
    expect(requests).toBe(1);
  } finally { release(); }
  await expect(page.getByLabel('Close customer editor')).not.toBeVisible();
  expect((await data.snapshot()).customers.filter(c => c.name === name)).toHaveLength(1);
});

test('profile refresh can retry and failed server sign-out still returns to login', async ({ page }) => {
  await signIn(page); await tab(page, 'Profile');
  await page.route(`${apiURL}/app-data`, route => route.abort('connectionfailed'), { times: 1 });
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(activeText(page, 'Could not refresh. Check your connection and try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(activeText(page, 'Could not refresh. Check your connection and try again.')).not.toBeVisible();
  await page.route(`${apiURL}/auth/logout`, route => route.abort('connectionfailed'), { times: 1 });
  await confirm(page, () => page.getByRole('button', { name: 'Sign out' }).click());
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
