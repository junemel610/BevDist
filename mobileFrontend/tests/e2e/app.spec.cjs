const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { username, password, apiURL, webURL } = require('./settings.cjs');
const { signIn, tab, confirm, business, clientHeaders } = require('./helpers.cjs');

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(clientHeaders());
  // Fail closed if a stale bundle points at a developer's application API.
  await page.route('**/*', route => [apiURL, webURL].includes(new URL(route.request().url()).origin)
    ? route.continue() : route.abort('blockedbyclient'));
});

test('login validation, real navigation, refresh and confirmed sign-out', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your username.', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid username or password', { exact: true })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  for (const [label, heading] of [['Invoice', 'Invoice management'], ['Stock', 'Inventory'], ['Orders', 'Supplier order'], ['Balance', 'Balance tracker'], ['Profile', 'My profile']]) {
    await tab(page, label);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(page.getByRole('button', { name: 'Refresh records' })).toBeEnabled();
  await confirm(page, () => page.getByRole('button', { name: 'Sign out' }).click(), false);
  await expect(page.getByText('Signed in as', { exact: true })).toBeVisible();
  await confirm(page, () => page.getByRole('button', { name: 'Sign out' }).click());
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('quick create validates cases, applies container refunds and persists an invoice', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page);
  await page.getByRole('button', { name: /Create Invoice/ }).click();
  await expect(page.getByLabel('Close create invoice', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(data.customer.name) }).click();
  const quantity = page.getByLabel(`${data.product.name}, A · 12 bottles/case, quantity in cases`, { exact: true });
  await quantity.fill('0.25');
  await expect(page.getByText('Use half-case steps: 0.5, 1, 1.5…', { exact: true })).toBeVisible();
  await quantity.fill('21');
  await expect(page.getByText('Only 20 cases available.', { exact: true })).toBeVisible();
  await quantity.fill('1.5');
  await page.getByRole('button', { name: 'Add returned case type' }).click();
  await page.getByLabel('Return type, row 1', { exact: true }).fill('Empty A');
  await page.getByLabel('Refund per case, row 1', { exact: true }).fill('20');
  const save = () => page.getByRole('button', { name: 'Create invoice' }).last().click();
  await confirm(page, save, false);
  expect((await data.snapshot()).orders.filter(o => o.customerId === data.customer.id)).toHaveLength(0);
  await confirm(page, save);
  await expect(page.getByLabel('Close create invoice', { exact: true })).not.toBeVisible();
  const snapshot = await data.snapshot();
  const invoice = snapshot.orders.find(o => o.customerId === data.customer.id);
  expect(invoice.grandTotal).toBe(140);
  expect(invoice.items[0].quantity).toBe(1.5);
  expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack.A).toMatchObject({ totalStock: 20, reservedStock: 1.5 });
  await page.reload();
  await signIn(page);
  await tab(page, 'Invoice');
  await page.getByLabel('Search invoices by invoice number or customer', { exact: true }).fill(invoice.invoiceNumber);
  await expect(page.getByRole('button', { name: `View details for ${invoice.invoiceNumber}` })).toBeVisible();
});

test('oldest-first Bank Transfer, delivery and excess credit reconcile with persisted balances', async ({ page, request }) => {
  const data = await business(request), first = await data.invoice(), second = await data.invoice();
  await signIn(page);
  await tab(page, 'Invoice');
  let snapshot = await data.snapshot();
  const invoice = snapshot.orders.find(o => o.id === second.id);
  await page.getByLabel('Search invoices by invoice number or customer', { exact: true }).fill(invoice.invoiceNumber);
  await page.getByRole('button', { name: `View details for ${invoice.invoiceNumber}` }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByLabel('Payment received in pesos')).toHaveValue('0');
  await page.getByLabel('Payment received in pesos').fill('150');
  await page.getByRole('radio', { name: 'Bank Transfer' }).click();
  await confirm(page, () => page.getByRole('button', { name: 'Record payment' }).click());
  await expect(page.getByLabel('Payment received in pesos')).not.toBeVisible();
  snapshot = await data.snapshot();
  expect(snapshot.balances.find(b => b.orderId === first.id).remainingBalance).toBe(0);
  expect(snapshot.balances.find(b => b.orderId === second.id).remainingBalance).toBe(50);
  await page.getByRole('button', { name: `View details for ${invoice.invoiceNumber}` }).click();
  await confirm(page, () => page.getByText('Mark delivered', { exact: true }).click());
  await expect(page.getByLabel('Close invoice details', { exact: true })).not.toBeVisible();
  snapshot = await data.snapshot();
  expect(snapshot.orders.find(o => o.id === second.id)).toMatchObject({ status: 'pending', deliveryStatus: 'delivered' });
  expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack.A.totalStock).toBe(19);
  await page.getByRole('button', { name: `View details for ${invoice.invoiceNumber}` }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByLabel('Payment received in pesos').fill('100');
  await confirm(page, () => page.getByRole('button', { name: 'Record payment' }).click());
  await expect(page.getByLabel('Payment received in pesos')).not.toBeVisible();
  snapshot = await data.snapshot();
  expect(snapshot.orders.find(o => o.id === second.id).status).toBe('completed');
  expect(snapshot.customerCredits[`customer:${data.customer.id}`]).toBe(50);
  const next = await data.invoice();
  snapshot = await data.snapshot();
  expect(snapshot.balances.find(b => b.orderId === next.id)).toMatchObject({ appliedCredit: 50, remainingBalance: 50 });
});

test('inventory editing changes case stock and zero-stock deletion archives the product', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page);
  await tab(page, 'Stock');
  await page.getByLabel('Search inventory by product or supplier').fill(data.product.name);
  await page.getByRole('button', { name: `Edit ${data.product.name} inventory` }).click();
  await page.getByLabel('A · 12 bottles/case quantity in cases', { exact: true }).fill('0');
  await page.getByLabel('A · 12 bottles/case price per case in pesos', { exact: true }).fill('120');
  await page.getByLabel('Stock count reason', { exact: true }).fill('E2E physical count');
  await confirm(page, () => page.getByRole('button', { name: 'Save changes' }).click());
  await expect(page.getByLabel('Close inventory editor')).not.toBeVisible();
  expect((await data.snapshot()).products.find(p => p.id === data.product.id).casePrices.A).toBe(120);
  await page.getByRole('button', { name: `Edit ${data.product.name} inventory` }).click();
  await confirm(page, () => page.getByRole('button', { name: 'Delete' }).click());
  await expect(page.getByRole('button', { name: `Edit ${data.product.name} inventory` })).not.toBeVisible();
  expect((await data.snapshot()).products.some(p => p.id === data.product.id)).toBe(false);
});

test('supplier orders persist half-case receipts and open their details', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page);
  await tab(page, 'Orders');
  await page.getByRole('button', { name: new RegExp(data.supplierName) }).click();
  await page.getByRole('button', { name: /Add product/ }).click();
  await page.getByRole('button', { name: new RegExp(data.product.name) }).click();
  await page.getByLabel(`${data.product.name} quantity in cases`, { exact: true }).fill('0.5');
  await page.getByLabel(`${data.product.name} cost per case in pesos`, { exact: true }).fill('80');
  await confirm(page, () => page.getByRole('button', { name: 'Save supplier order' }).click());
  const details = page.getByRole('button', { name: new RegExp(`View ${data.supplierName} supplier order`) });
  await expect(details).toBeVisible();
  await details.click();
  await expect(page.getByRole('button', { name: 'Close supplier order details' })).toBeVisible();
  const snapshot = await data.snapshot();
  expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack.A.totalStock).toBe(20.5);
});

test('customer profiles save through the browser and GCash history is reachable', async ({ page, request }) => {
  const data = await business(request), invoice = await data.invoice();
  await data.post(`/customers/${data.customer.id}/payments`, { requestKey: randomUUID(), method: 'GCash', amountReceived: 120 });
  await signIn(page);
  await tab(page, 'Invoice');
  await page.getByRole('button', { name: 'Manage customer profiles' }).click();
  await page.getByRole('button', { name: 'Add customer' }).click();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Enter a customer name.', { exact: true })).toBeVisible();
  const name = `New Store ${randomUUID().slice(0, 8)}`;
  await page.getByLabel('Customer name, required', { exact: true }).fill(name);
  await confirm(page, () => page.getByRole('button', { name: 'Save profile' }).click());
  await expect(page.getByRole('button', { name: `Edit ${name} profile` })).toBeVisible();
  expect((await data.snapshot()).customers.some(c => c.name === name)).toBe(true);
  await tab(page, 'Balance');
  await page.getByRole('button', { name: /View .*customer/ }).click();
  await page.getByLabel('Search customer credits', { exact: true }).fill(data.customer.name);
  await expect(page.getByText(data.customer.name, { exact: true }).and(page.locator(':not([aria-hidden="true"] *)'))).toBeVisible();
  await page.getByRole('link', { name: 'Balances, back' }).click();
  await page.getByRole('button', { name: 'Open GCash transactions' }).click();
  await expect(page.getByText(new RegExp((await data.snapshot()).orders.find(o => o.id === invoice.id).invoiceNumber)).and(page.locator(':not([aria-hidden="true"] *)'))).toBeVisible();
});
