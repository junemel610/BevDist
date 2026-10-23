const { randomUUID, randomInt } = require('node:crypto');
const { expect } = require('@playwright/test');
const { apiURL, username, password } = require('./settings.cjs');

const clientHeaders = () => ({ 'X-Forwarded-For': `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}` });
async function signIn(page) {
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}
async function tab(page, name) { await page.getByRole('tab', { name: new RegExp(name) }).click(); }
async function confirm(page, action, accept = true) {
  const dialog = page.waitForEvent('dialog');
  const click = action();
  const prompt = await dialog;
  expect(prompt.type()).toBe('confirm');
  await (accept ? prompt.accept() : prompt.dismiss());
  await click;
}
async function business(request) {
  const headers = clientHeaders();
  const login = await request.post(`${apiURL}/auth/login`, { data: { username, password }, headers });
  expect(login.ok(), await login.text()).toBeTruthy();
  headers.Authorization = `Bearer ${(await login.json()).token}`;
  const post = async (route, data) => {
    const response = await request.post(apiURL + route, { data, headers });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const snapshot = async () => {
    const response = await request.get(`${apiURL}/app-data`, { headers });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const suffix = randomUUID().slice(0, 8);
  const customer = { name: `Test Store ${suffix}`, ...(await post('/customers', { name: `Test Store ${suffix}`, contact: '09123456789', address: 'Test address' })) };
  const productName = `Test Cola ${suffix}`, supplierName = `Test Supplier ${suffix}`;
  const product = { name: productName, ...(await post('/products', {
    name: productName, supplierName, stockReason: 'E2E opening count',
    packs: [{ packId: 'A', casePrice: 100, totalStock: 20, lowStockThreshold: 2 }],
  })) };
  const invoice = async (quantity = 1) => post('/invoices', {
    customerId: customer.id, requestKey: randomUUID(), dueDate: '2099-12-31',
    items: [{ productId: product.id, packId: 'A', quantity }],
  });
  return { customer, product, supplierName, post, snapshot, invoice };
}
module.exports = { signIn, tab, confirm, business, clientHeaders };
