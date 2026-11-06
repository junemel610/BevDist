const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { apiURL } = require('./settings.cjs');
const { business, signIn, tab, confirm, preparePage, activeText, rejectedSave } = require('./helpers.cjs');
test.beforeEach(preparePage);

test('add product with one generic case unit, direct case price and half-case stock', async ({ page, request }) => {
    const data = await business(request);
    await signIn(page); await tab(page, 'Stock');
    await page.getByRole('button', { name: 'Add product' }).click();
    const name = `Generic Beverage ${randomUUID().slice(0, 8)}`;
    await page.getByLabel('Product name', { exact: true }).fill(name);
    await page.getByLabel('Search saved suppliers', { exact: true }).fill(data.supplierName);
    await page.getByRole('radio', { name: `Select supplier ${data.supplierName}`, exact: true }).click();
    await page.getByLabel('Case quantity in cases', { exact: true }).fill('0.5');
    await page.getByLabel('Case selling price per case in pesos', { exact: true }).fill('100');
    await confirm(page, () => page.getByRole('button', { name: 'Add product' }).last().click());
    await expect(page.getByLabel('Close inventory editor')).not.toBeVisible();
    const saved = (await data.snapshot()).products.find(p => p.name === name);
    expect(saved.casePackIds).toEqual(['B']);
    await page.getByLabel('Search inventory by product or supplier').fill(name);
    expect(saved.casePrices.B).toBe(100);
    expect(saved.stockByCasePack.B.totalStock).toBe(0.5);
    await expect(page.getByLabel('Case: Low stock, 0.5 cases available', { exact: true })).toBeVisible();
});

test('inventory validation rejects invalid counts, missing reasons and deletion of stocked products', async ({ page, request }) => {
  const data = await business(request); await data.invoice();
  await signIn(page); await tab(page, 'Stock');
  await page.getByLabel('Search inventory by product or supplier').fill(data.product.name);
  await page.getByRole('button', { name: `Edit ${data.product.name} inventory` }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(activeText(page, 'Enter a reason for this stock count.')).toBeVisible();
  await page.getByLabel('Stock count reason', { exact: true }).fill('Invalid stock test');
  for (const count of ['0.25', '0', '-1']) {
    await page.getByLabel('Case quantity in cases', { exact: true }).fill(count);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(activeText(page, 'Enter stock in half-case steps at least as high as reserved stock, and a price greater than ₱0.')).toBeVisible();
  }
  await rejectedSave(page, () => page.getByRole('button', { name: 'Delete', exact: false }).click(), /stock|reserv/i);
  expect((await data.snapshot()).products.find(p => p.id === data.product.id).stockByCasePack.B.totalStock).toBe(20);
});

test('stale inventory counts fail atomically and refresh loads the new physical count', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page); await tab(page, 'Stock');
  await page.getByLabel('Search inventory by product or supplier').fill(data.product.name);
  await page.getByRole('button', { name: `Edit ${data.product.name} inventory` }).click();
  const product = (await data.snapshot()).products.find(p => p.id === data.product.id);
  const update = await request.put(`${apiURL}/products/${product.id}`, { headers: data.headers, data: { name: product.name, supplierId: product.supplierId, stockReason: 'Concurrent count', packs: [{ packId: 'B', casePrice: 100, totalStock: 21, expectedStock: 20 }] } });
  expect(update.ok()).toBeTruthy();
  await page.getByLabel('Stock count reason', { exact: true }).fill('Stale count');
  await page.getByLabel('Case selling price per case in pesos', { exact: true }).fill('999');
  await rejectedSave(page, () => page.getByRole('button', { name: 'Save changes' }).click(), /refresh|stock.*changed/i);
  expect((await data.snapshot()).products.find(p => p.id === data.product.id).casePrices.B).toBe(100);
  await page.getByLabel('Close inventory editor').click();
  await tab(page, 'Profile'); await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(page.getByRole('button', { name: 'Refresh records' })).toBeEnabled();
  await tab(page, 'Stock'); await page.getByRole('button', { name: `Edit ${data.product.name} inventory` }).click();
  await expect(page.getByLabel('Case quantity in cases', { exact: true })).toHaveValue('21');
});

test('stock status, supplier filters, search and clear return the matching products', async ({ page, request }) => {
  const data = await business(request), saved = (await data.snapshot()).products.find(p => p.id === data.product.id);
  for (const [suffix, stock] of [['Low', 1], ['Empty', 0]]) await data.post('/products', { name: `${suffix} ${data.product.name}`, supplierId: saved.supplierId, stockReason: 'Filter fixture', packs: [{ packId: 'B', casePrice: 100, totalStock: stock }] });
  await signIn(page); await tab(page, 'Stock');
  await page.getByRole('button', { name: new RegExp(data.supplierName) }).click();
  await page.getByRole('button', { name: /^In stock/ }).click();
  await expect(page.getByRole('button', { name: `Edit ${data.product.name} inventory`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Edit Low ${data.product.name} inventory`, exact: true })).not.toBeVisible();
  for (const [filter, prefix] of [['Low stock', 'Low'], ['Out of stock', 'Empty']]) {
    await page.getByRole('button', { name: new RegExp(`^${filter}`) }).click();
    await expect(page.getByRole('button', { name: `Edit ${prefix} ${data.product.name} inventory`, exact: true })).toBeVisible();
  }
  await page.getByLabel('Search inventory by product or supplier').fill('missing-product');
  await expect(page.getByRole('button', { name: `Edit Empty ${data.product.name} inventory`, exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.getByRole('button', { name: `Edit Empty ${data.product.name} inventory`, exact: true })).toBeVisible();
});

test('new product form validates required fields, duplicate names and invalid case prices', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page); await tab(page, 'Stock');
  await page.getByRole('button', { name: 'Add product' }).click();
  const save = page.getByRole('button', { name: 'Add product' }).last();
  await save.click();
  await expect(activeText(page, 'Product name and supplier are required.')).toBeVisible();
  await page.getByLabel('Product name', { exact: true }).fill(data.product.name);
  await page.getByLabel('Search saved suppliers', { exact: true }).fill(data.supplierName);
    await page.getByRole('radio', { name: `Select supplier ${data.supplierName}`, exact: true }).click();
  await save.click();
  await expect(activeText(page, 'A product with this name already exists.')).toBeVisible();
  await page.getByLabel('Product name', { exact: true }).fill(`New ${data.product.name}`);
  await page.getByLabel('Case quantity in cases', { exact: true }).fill('0.25');
  await page.getByLabel('Case selling price per case in pesos', { exact: true }).fill('0');
  await save.click();
  await expect(activeText(page, 'Enter stock in half-case steps and a numeric selling price greater than ₱0.')).toBeVisible();
  await page.getByLabel('Close inventory editor').click();
  expect((await data.snapshot()).products.some(p => p.name === `New ${data.product.name}`)).toBe(false);
});
