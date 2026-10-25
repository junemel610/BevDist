const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { business, signIn, tab, confirm, preparePage, openInvoice, activeText } = require('./helpers.cjs');
test.beforeEach(preparePage);

test('inline new customer, case steppers, empty cart, modal close and stock notification actions', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page);
  await tab(page, 'Invoice');
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create invoice', exact: true }).last()).toBeDisabled();
  await page.getByLabel('Close create invoice', { exact: true }).click();
  await expect(page.getByLabel('Close create invoice', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
  await page.getByRole('button', { name: /New customer/ }).click();
  const name = `Inline Store ${randomUUID().slice(0, 8)}`;
  await page.getByLabel('New customer name, required').fill(name);
  await page.getByLabel('New customer contact number, optional').fill('09111111111');
  await page.getByLabel('New customer address, optional').fill('Test address');
  const add = page.getByRole('button', { name: `Add half a A · 12 bottles per case case of ${data.product.name}` });
  const subtract = page.getByRole('button', { name: `Remove half a A · 12 bottles per case case of ${data.product.name}` });
  await add.click(); await add.click(); await subtract.click();
  await expect(page.getByLabel(`${data.product.name}, A · 12 bottles per case, quantity in cases`, { exact: true })).toHaveValue('0.5');
  await confirm(page, () => page.getByRole('button', { name: 'Create invoice', exact: true }).last().click());
  await expect(page.getByLabel('Close create invoice')).not.toBeVisible();
  const snapshot = await data.snapshot(), customer = snapshot.customers.find(c => c.name === name);
  expect(customer).toMatchObject({ contact: '09111111111', address: 'Test address' });
  expect(snapshot.orders.find(o => o.customerId === customer.id).grandTotal).toBe(50);
  await expect(page.getByRole('button', { name: 'View stock' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(page.getByRole('button', { name: 'Dismiss notification' })).not.toBeVisible();
});

test('pending invoice edits preserve settlements, validate refunds and replace case reservations', async ({ page, request }) => {
  const data = await business(request), invoice = await data.invoice(1, { containerReturns: [{ type: 'Old empty', quantity: 0.5, refundPerCase: 20 }] });
  const followup = `Followup ${data.product.name}`;
  await data.post('/products', { name: followup, supplierId: (await data.snapshot()).products.find(p => p.id === data.product.id).supplierId, stockReason: 'Followup stock', packs: [{ packId: 'B', casePrice: 50, totalStock: 1 }] });
  await data.post(`/customers/${data.customer.id}/payments`, { method: 'Cash', amountReceived: 20, requestKey: randomUUID() });
  await signIn(page); await openInvoice(page, data, invoice.id);
  await page.getByText('Edit invoice', { exact: true }).click();
  const quantity = page.getByLabel(`${data.product.name}, A · 12 bottles per case, quantity in cases`, { exact: true });
  await quantity.fill('0.5');
  await page.getByLabel('Returned cases, row 1').fill('0.25');
  await expect(activeText(page, 'Returned quantities must use half-case steps, starting at 0.5 case.')).toBeVisible();
  await page.getByLabel('Returned cases, row 1').fill('0.5');
  await page.getByLabel('Refund per case, row 1').fill('100');
  await expect(activeText(page, 'The new invoice total cannot be lower than payments and credit already applied.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save invoice changes' })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove returned case row 1' }).click();
  await quantity.fill('2.5');
  await page.getByLabel(`${followup}, B · 24 bottles per case, quantity in cases`, { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Add returned case type' }).click();
  await page.getByLabel('Return type, row 1').fill('New empty');
  await page.getByLabel('Refund per case, row 1').fill('20');
  const save = () => page.getByRole('button', { name: 'Save invoice changes' }).click();
  await confirm(page, save, false);
  expect((await data.snapshot()).orders.find(o => o.id === invoice.id).grandTotal).toBe(90);
  await confirm(page, save);
  await expect(page.getByLabel('Close edit pending invoice')).not.toBeVisible();
  const snapshot = await data.snapshot();
  expect(snapshot.orders.find(o => o.id === invoice.id)).toMatchObject({ grandTotal: 265, containerReturns: [expect.objectContaining({ type: 'New empty', quantity: 0.5 })] });
  expect(snapshot.balances.find(b => b.orderId === invoice.id)).toMatchObject({ amountPaid: 20, remainingBalance: 245 });
  expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack.A.reservedStock).toBe(2.5);
  await openInvoice(page, data, invoice.id);
  await page.getByText('Edit invoice', { exact: true }).click();
  await page.getByRole('button', { name: 'Remove returned case row 1' }).click();
  await confirm(page, () => page.getByRole('button', { name: 'Save invoice changes' }).click());
  await expect(page.getByLabel('Close edit pending invoice')).not.toBeVisible();
  expect((await data.snapshot()).orders.find(o => o.id === invoice.id)).toMatchObject({ grandTotal: 275, containerReturns: [] });
  await page.getByRole('button', { name: 'View stock' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
});

test('cancellation releases reservations, remains in history and disables further changes', async ({ page, request }) => {
  const data = await business(request), invoice = await data.invoice(0.5);
  await signIn(page); const order = await openInvoice(page, data, invoice.id);
  await confirm(page, () => page.getByText('Cancel invoice', { exact: true }).click(), false);
  expect((await data.snapshot()).orders.find(o => o.id === invoice.id).status).toBe('pending');
  await confirm(page, () => page.getByText('Cancel invoice', { exact: true }).click());
  await expect(page.getByLabel('Close invoice details')).not.toBeVisible();
  const snapshot = await data.snapshot();
  expect(snapshot.orders.find(o => o.id === invoice.id).status).toBe('cancelled');
  expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack.A).toMatchObject({ totalStock: 20, reservedStock: 0 });
  await page.getByRole('button', { name: /^Cancelled,/ }).click();
  await page.getByRole('button', { name: `View details for ${order.invoiceNumber}` }).click();
  for (const action of ['Edit invoice', 'Cancel invoice', 'Mark delivered', 'Record payment']) await expect(activeText(page, action)).not.toBeVisible();
});

test('invoice filters, search and clear distinguish outstanding and fully paid invoices', async ({ page, request }) => {
  const data = await business(request), paid = await data.invoice();
  await data.post(`/customers/${data.customer.id}/payments`, { method: 'Cash', amountReceived: 100, requestKey: randomUUID() });
  const unpaid = await data.invoice();
  const snapshot = await data.snapshot(), paidNumber = snapshot.orders.find(o => o.id === paid.id).invoiceNumber, unpaidNumber = snapshot.orders.find(o => o.id === unpaid.id).invoiceNumber;
  await signIn(page); await tab(page, 'Invoice');
  await page.getByLabel('Search invoices by invoice number or customer', { exact: true }).fill(data.customer.name);
  await page.getByRole('button', { name: /^Outstanding,/ }).click();
  await expect(page.getByRole('button', { name: `View details for ${unpaidNumber}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `View details for ${paidNumber}` })).not.toBeVisible();
  await page.getByRole('button', { name: /^Fully paid,/ }).click();
  await expect(page.getByRole('button', { name: `View details for ${paidNumber}` })).toBeVisible();
  await page.getByLabel('Search invoices by invoice number or customer', { exact: true }).fill('no-such-invoice');
  await expect(activeText(page, 'No invoices found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear invoice search' }).click();
  await expect(page.getByLabel('Search invoices by invoice number or customer', { exact: true })).toHaveValue('');
});

test('fully paid invoices complete only after delivery and completed details stay read-only', async ({ page, request }) => {
  const data = await business(request), invoice = await data.invoice();
  await data.post(`/customers/${data.customer.id}/payments`, { method: 'Cash', amountReceived: 100, requestKey: randomUUID() });
  await signIn(page); const order = await openInvoice(page, data, invoice.id);
  await expect(activeText(page, 'Pending delivery')).toBeVisible();
  await confirm(page, () => page.getByText('Mark delivered', { exact: true }).click());
  await expect(page.getByLabel('Close invoice details')).not.toBeVisible();
  await page.getByRole('button', { name: `View details for ${order.invoiceNumber}` }).click();
  for (const action of ['Edit invoice', 'Cancel invoice', 'Mark delivered', 'Record payment']) await expect(activeText(page, action)).not.toBeVisible();
  const snapshot = await data.snapshot();
  expect(snapshot.orders.find(o => o.id === invoice.id)).toMatchObject({ status: 'completed', deliveryStatus: 'delivered' });
  expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack.A.totalStock).toBe(19);
});

for (const [packId, packLabel, units] of [['A', 'A · 12 bottles per case', 12], ['B', 'B · 24 bottles per case', 24], ['C', 'C · 6 bottles per case', 6], ['MUCHO_6', 'Mucho 6 · 6 bottles per case', 6], ['MUCHO_12', 'Mucho 12 · 12 bottles per case', 12]]) {
  test(`invoice ${packId} accepts a half case at its direct case price without converting stock to bottles`, async ({ page, request }) => {
    const data = await business(request, { name: packId.startsWith('MUCHO') ? 'Mucho Beverage' : 'Case Beverage', packs: [{ packId, casePrice: 120, totalStock: 2 }] });
    await signIn(page); await tab(page, 'Invoice');
    await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(data.customer.name) }).click();
    await page.getByLabel(`${data.product.name}, ${packLabel}, quantity in cases`, { exact: true }).fill('0.5');
    await confirm(page, () => page.getByRole('button', { name: 'Create invoice', exact: true }).last().click());
    await expect(page.getByLabel('Close create invoice')).not.toBeVisible();
    const snapshot = await data.snapshot(), invoice = snapshot.orders.find(o => o.customerId === data.customer.id);
    expect(invoice.grandTotal).toBe(60);
    expect(invoice.items[0]).toMatchObject({ packId, quantity: 0.5, stockQuantity: 0.5, unitsPerCase: units, casePrice: 120 });
    expect(snapshot.products.find(p => p.id === data.product.id).stockByCasePack[packId]).toMatchObject({ totalStock: 2, reservedStock: 0.5 });
  });
}
