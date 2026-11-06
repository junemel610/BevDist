const { randomUUID, randomInt } = require('node:crypto');
const { expect } = require('@playwright/test');
const { apiURL, webURL, username, password } = require('./settings.cjs');

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
async function preparePage({ page }) {
  await page.setExtraHTTPHeaders(clientHeaders());
  // Fail closed if a stale bundle points at a developer's application API.
  await page.route('**/*', route => [apiURL, webURL].includes(new URL(route.request().url()).origin)
    ? route.continue() : route.abort('blockedbyclient'));
}
const activeText = (page, text) => page.getByText(text, { exact: true }).and(page.locator(':not([aria-hidden="true"] *)'));
async function openInvoice(page, data, id) {
  const order = (await data.snapshot()).orders.find(o => o.id === id);
  await tab(page, 'Invoice');
  await page.getByLabel('Search invoices by invoice number or customer', { exact: true }).fill(order.invoiceNumber);
  await page.getByRole('button', { name: `View details for ${order.invoiceNumber}` }).click();
  return order;
}
async function selectInvoiceProduct(page, name) {
  await page.getByRole('button', { name: 'Select products', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`Add ${name} to invoice`) }).click();
  await page.getByRole('button', { name: 'Done selecting products', exact: true }).click();
}
async function scrollUntilVisible(page, locator) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width / 2, height / 2);
  await expect(async () => {
    if (!await locator.count()) await page.mouse.wheel(0, 1200);
    await expect(locator).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 15000, intervals: [100] });
}
async function rejectedSave(page, action, message) {
  const waiting = page.waitForEvent('dialog', dialog => dialog.type() === 'alert');
  const confirmation = confirm(page, action);
  const alert = await waiting;
  expect(alert.message()).toMatch(message);
  await alert.dismiss();
  await confirmation;
}
async function business(request, options = {}) {
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
  const productName = `${options.name || 'Test Cola'} ${suffix}`, supplierName = `Test Supplier ${suffix}`;
  const product = { name: productName, ...(await post('/products', {
    name: productName, supplierName, stockReason: 'E2E opening count',
    packs: options.packs || [{ packId: 'B', casePrice: 100, totalStock: 20, lowStockThreshold: 2 }],
  })) };
  const invoice = async (quantity = 1, extra = {}) => post('/invoices', {
    customerId: customer.id, requestKey: randomUUID(), dueDate: '2099-12-31',
    items: [{ productId: product.id, packId: 'B', quantity }], ...extra,
  });
  return { customer, product, supplierName, post, snapshot, invoice, headers };
}
module.exports = { signIn, tab, confirm, business, clientHeaders, preparePage, activeText, openInvoice, selectInvoiceProduct, rejectedSave, scrollUntilVisible };
