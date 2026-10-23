const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { business, signIn, tab, confirm, preparePage, activeText, scrollUntilVisible } = require('./helpers.cjs');
test.beforeEach(preparePage);
const peso = value => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

for (const method of ['Cash', 'GCash', 'Bank Transfer']) {
  test(`${method} payment from Balances validates amount and immediately reconciles dashboard totals`, async ({ page, request }) => {
    const data = await business(request); await data.invoice();
    await signIn(page); await tab(page, 'Balance');
    await page.getByLabel('Search balances by customer or invoice number', { exact: true }).fill(data.customer.name);
    await page.getByRole('button', { name: new RegExp(`Record customer payment for ${data.customer.name},`) }).click();
    await expect(page.getByLabel('Payment received in pesos')).toHaveValue('0');
    for (const amount of ['0', '-1', '1.001']) {
      await page.getByLabel('Payment received in pesos').fill(amount);
      await page.getByRole('button', { name: 'Record payment' }).click();
      await expect(activeText(page, 'Enter an amount above ₱0, with up to two decimal places.')).toBeVisible();
    }
    await page.getByLabel('Payment received in pesos').fill('40');
    await page.getByRole('radio', { name: new RegExp(`(^|\\s)${method}$`) }).click();
    await expect(page.getByRole('radio', { name: new RegExp(`(^|\\s)${method}$`), checked: true })).toBeVisible();
    await confirm(page, () => page.getByRole('button', { name: 'Record payment' }).click(), false);
    expect((await data.snapshot()).payments.filter(p => p.customerId === data.customer.id)).toHaveLength(0);
    await confirm(page, () => page.getByRole('button', { name: 'Record payment' }).click());
    await expect(page.getByLabel('Close payment form')).not.toBeVisible();
    const snapshot = await data.snapshot();
    expect(snapshot.payments.find(p => p.customerId === data.customer.id)).toMatchObject({ method, amountReceived: 40 });
    await tab(page, 'Home');
    const expected = snapshot.orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.grandTotal, 0);
    const actual = snapshot.paymentTransactions.filter(p => p.method === 'Cash').reduce((sum, p) => sum + p.amountApplied, 0);
    await expect(activeText(page, 'Total expected').locator('..').getByText(peso(expected), { exact: true })).toBeVisible();
    await expect(activeText(page, 'Actual sales').locator('..').getByText(peso(actual), { exact: true })).toBeVisible();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const applied = snapshot.paymentTransactions.filter(p => p.method === method && p.date === day).reduce((sum, p) => sum + p.amountApplied, 0);
    await expect(activeText(page, method).locator('..').getByText(peso(applied), { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Daily Cash Sales', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monthly Cash Sales', exact: true })).toBeVisible();
    expect(await page.locator('svg').count()).toBeGreaterThan(0);
  });
}

test('balance status filters, search/clear and payment form close retain historical invoices', async ({ page, request }) => {
  const data = await business(request), paid = await data.invoice();
  await data.post(`/customers/${data.customer.id}/payments`, { amountReceived: 100, method: 'Cash', requestKey: randomUUID() });
  const cancelled = await data.invoice(); await data.post(`/invoices/${cancelled.id}/cancel`, { reason: 'Filter test' });
  const overdue = await data.invoice(1, { dueDate: '2020-01-01' });
  await data.invoice();
  const snapshot = await data.snapshot(), number = id => snapshot.orders.find(o => o.id === id).invoiceNumber;
  await signIn(page); await tab(page, 'Balance');
  await page.getByLabel('Search balances by customer or invoice number', { exact: true }).fill(data.customer.name);
  for (const [label, id] of [['Paid', paid.id], ['Cancelled', cancelled.id], ['Overdue', overdue.id]]) {
    await page.getByRole('button', { name: new RegExp(`^${label},`) }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${label},`) })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(new RegExp(number(id))).and(page.locator(':not([aria-hidden="true"] *)'))).toBeVisible();
  }
  await page.getByRole('button', { name: /^Unpaid,/ }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Record customer payment for ${data.customer.name},`) })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Record customer payment for ${data.customer.name},`) }).click();
  await page.getByLabel('Close payment form').click();
  await page.getByLabel('Search balances by customer or invoice number', { exact: true }).fill('not-found');
  await expect(activeText(page, 'No balances found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear balance search' }).click();
  await expect(page.getByLabel('Search balances by customer or invoice number', { exact: true })).toHaveValue('');
});

test('dashboard supplier, balances and View All shortcuts open their actual navigation stacks', async ({ page }) => {
  await signIn(page);
  for (const [action, heading] of [['Supplier Orders', 'Supplier order'], ['Outstanding Balances', 'Balance tracker'], ['View all invoices', 'Invoice management']]) {
    await page.getByRole('button', { name: new RegExp(action, 'i') }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await tab(page, 'Home');
  }
});

test('customer profile editing persists and credit search handles empty results', async ({ page, request }) => {
  const data = await business(request); await data.invoice();
  await data.post(`/customers/${data.customer.id}/payments`, { amountReceived: 125, method: 'GCash', requestKey: randomUUID() });
  await signIn(page); await tab(page, 'Invoice');
  await page.getByRole('button', { name: 'Manage customer profiles' }).click();
  const edit = page.getByRole('button', { name: `Edit ${data.customer.name} profile` });
  await scrollUntilVisible(page, edit);
  await edit.click();
  await page.getByLabel('Customer contact number', { exact: true }).fill('09999999999');
  await page.getByLabel('Customer address', { exact: true }).fill('Updated address');
  await confirm(page, () => page.getByRole('button', { name: 'Save profile' }).click(), false);
  expect((await data.snapshot()).customers.find(c => c.id === data.customer.id).contact).toBe('09123456789');
  await confirm(page, () => page.getByRole('button', { name: 'Save profile' }).click());
  await expect(page.getByLabel('Close customer editor')).not.toBeVisible();
  expect((await data.snapshot()).customers.find(c => c.id === data.customer.id)).toMatchObject({ contact: '09999999999', address: 'Updated address' });
  await tab(page, 'Balance'); await page.getByRole('button', { name: /View .*customer/ }).click();
  await page.getByLabel('Search customer credits').fill('does-not-exist');
  await expect(activeText(page, 'No matching customers.')).toBeVisible();
  await page.getByLabel('Search customer credits').fill(data.customer.name);
  await expect(activeText(page, data.customer.name)).toBeVisible();
  await expect(activeText(page, '₱25')).toBeVisible();
});
