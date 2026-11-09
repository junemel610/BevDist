const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { business, signIn, tab, createSupplierOrder, confirm, preparePage, activeText, rejectedSave } = require('./helpers.cjs');
const { apiURL } = require('./settings.cjs');
test.beforeEach(preparePage);
const unique = label => `${label} ${randomUUID().slice(0, 8)}`;
async function stockPack(page) {
  await page.getByLabel('Case quantity in cases', { exact: true }).fill('0.5');
  await page.getByLabel('Case selling price per case in pesos', { exact: true }).fill('120');
}
async function newReceiptProduct(page, name) {
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByRole('button', { name: /Create a new product/ }).click();
  await page.getByLabel('New product name', { exact: true }).fill(name);
  await page.getByLabel('Case selling price per case in pesos', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Add product lines' }).click();
}
async function selectSupplier(page, name) {
  await page.getByLabel('Search saved suppliers', { exact: true }).fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
}

test('stock selects a searched supplier with no products, confirms, and persists its identity', async ({ page, request }, testInfo) => {
  const data = await business(request), name = unique('Stock Drink'), supplierName = unique('Empty Depot');
  const supplier = await data.post('/suppliers', { name: supplierName });
  await signIn(page); await tab(page, 'Stock');
  await page.getByRole('button', { name: /Add product/ }).first().click();
  await page.getByLabel('Product name', { exact: true }).fill(name);
  await page.getByLabel('Search saved suppliers', { exact: true }).fill('zz-no-supplier');
  await expect(activeText(page, 'No suppliers found. Try another search or choose New supplier.')).toBeVisible();
  await page.getByLabel('Search saved suppliers', { exact: true }).fill(supplierName.toLowerCase());
  const choice = page.getByRole('radio', { name: `Select supplier ${supplierName}`, exact: true });
  await choice.click(); await expect(choice).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /New supplier/ }).click();
  await page.getByLabel('Supplier name', { exact: true }).fill('Unselected draft');
  await page.getByRole('radio', { name: /Existing supplier/ }).click();
  await stockPack(page);
  await page.screenshot({ path: testInfo.outputPath('stock-product-form.png') });
  const save = () => page.getByRole('button', { name: 'Add product', exact: true }).last().click();
  await confirm(page, save, false);
  expect((await data.snapshot()).products.some(p => p.name === name)).toBe(false);
  await confirm(page, save);
  await expect(page.getByLabel('Close inventory editor')).not.toBeVisible();
  const saved = (await data.snapshot()).products.find(p => p.name === name);
  expect(saved.supplierId).toBe(supplier.id);
  expect(saved.stockByCasePack.B.totalStock).toBe(0.5);
  expect(saved.casePrices.B).toBe(120);
});

test('stock new supplier validates duplicates, abandons drafts, and saves supplier with product', async ({ page, request }) => {
  const data = await business(request), name = unique('New Stock'), supplierName = unique('New Depot');
  await signIn(page); await tab(page, 'Stock');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Product name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: /New supplier/ }).click();
  await page.getByLabel('Supplier name', { exact: true }).fill(data.supplierName.toLowerCase());
  await page.getByRole('button', { name: 'Add product', exact: true }).last().click();
  await expect(activeText(page, 'This supplier is already saved. Choose Existing supplier.')).toBeVisible();
  await page.getByLabel('Supplier name', { exact: true }).fill(supplierName);
  await page.getByLabel('Close inventory editor').click();
  expect((await data.snapshot()).suppliers.some(s => s.name === supplierName)).toBe(false);
  await page.getByRole('button', { name: /Add product/ }).first().click();
  await expect(page.getByLabel('Product name', { exact: true })).toHaveValue('');
  await page.getByLabel('Product name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: /New supplier/ }).click();
  await page.getByLabel('Supplier name', { exact: true }).fill(supplierName);
  await stockPack(page);
  await confirm(page, () => page.getByRole('button', { name: 'Add product', exact: true }).last().click());
  await expect(page.getByLabel('Close inventory editor')).not.toBeVisible();
  const snapshot = await data.snapshot();
  expect(snapshot.suppliers.filter(s => s.name === supplierName)).toHaveLength(1);
  expect(snapshot.products.find(p => p.name === name).supplierId).toBe(snapshot.suppliers.find(s => s.name === supplierName).id);
});

test('stock product form fixes the unit to one generic Case', async ({ page, request }) => {
  const data = await business(request), name = unique('Generic Case Drink');
  await signIn(page); await tab(page, 'Stock');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Product name', { exact: true }).fill(name);
  await page.getByLabel('Search saved suppliers', { exact: true }).fill(data.supplierName);
  await page.getByRole('radio', { name: `Select supplier ${data.supplierName}`, exact: true }).click();
  await expect(page.getByText('Case', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await stockPack(page);
  await confirm(page, () => page.getByRole('button', { name: 'Add product', exact: true }).last().click());
  const saved = (await data.snapshot()).products.find(product => product.name === name);
  expect(saved.casePackIds).toEqual(['B']);
  expect(saved.stockByCasePack.B.totalStock).toBe(0.5);
});

test('receipt product search, new-product validation and supplier form cancellation preserve draft lines', async ({ page, request }) => {
  const data = await business(request);
  await signIn(page); await tab(page, 'Orders'); await createSupplierOrder(page); await selectSupplier(page, data.supplierName);
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Search products', { exact: true }).fill('zz-missing');
  await expect(activeText(page, 'No matching products. You can create a new product above.')).toBeVisible();
  await page.getByLabel('Search products', { exact: true }).fill(data.product.name.toLowerCase());
  await page.getByRole('button', { name: new RegExp(data.product.name) }).click();
  await page.getByLabel(`${data.product.name} quantity in cases`, { exact: true }).fill('1');
  await page.getByRole('button', { name: 'New supplier', exact: true }).click();
  await page.getByLabel('Close new supplier form').click();
  await expect(page.getByLabel(`${data.product.name} quantity in cases`, { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByRole('button', { name: /Create a new product/ }).click();
  const add = page.getByRole('button', { name: 'Add product lines' });
  await add.click(); await expect(page.getByText('Enter a product name.', { exact: true }).last()).toBeVisible();
  await page.getByLabel('New product name', { exact: true }).fill(data.product.name);
  await add.click(); await expect(page.getByText(/This supplier already has a product/).last()).toBeVisible();
  await page.getByLabel('New product name', { exact: true }).fill(unique('Unsaved'));
  for (const price of ['0', '-1', '1.001']) {
    await page.getByLabel('Case selling price per case in pesos').fill(price);
    await add.click(); await expect(page.getByText('Enter a numeric selling price per case.', { exact: true }).last()).toBeVisible();
  }
  await page.getByLabel('Close new product form').click();
  expect((await data.snapshot()).restockRecords.some(r => r.supplier === data.supplierName)).toBe(false);
});

test('new supplier and new product receipt save only on confirmation with manual return credit', async ({ page, request }, testInfo) => {
  const data = await business(request), supplierName = unique('Receipt Depot'), name = unique('Receipt Drink');
  await signIn(page); await tab(page, 'Orders'); await createSupplierOrder(page);
  await page.getByRole('button', { name: 'New supplier', exact: true }).click();
  await page.getByLabel('New supplier name').fill(supplierName);
  await page.getByLabel('New supplier contact').fill('09123');
  await page.getByLabel('New supplier address').fill('Warehouse');
  await page.getByRole('button', { name: 'Use supplier in this order' }).click();
  await newReceiptProduct(page, name);
    await page.getByLabel(`${name} quantity in cases`, { exact: true }).fill('0.5');
  await page.getByLabel(`${name} supplier cost per case in pesos`, { exact: true }).fill('80');
  await page.getByRole('button', { name: /Add return line/ }).click();
  const minus = page.getByRole('button', { name: 'Decrease quantity for return line 1', exact: true });
  await expect(minus).toBeDisabled();
  await page.getByRole('button', { name: 'Increase quantity for return line 1', exact: true }).click();
  await minus.click(); await expect(minus).toBeDisabled();
  await page.getByRole('button', { name: 'Increase quantity for return line 1', exact: true }).click();
  await page.getByLabel('Return line 1 container or item').fill('Bottle crate');
  const save = () => page.getByRole('button', { name: 'Save supplier order' }).click();
  await save(); await expect(page.getByText('Enter a refund per case for each returned item.', { exact: true }).last()).toBeVisible();
  await page.getByLabel('Return line 1 refund per case in pesos').fill('81');
  await save(); await expect(page.getByText('Return credits cannot exceed the product cost.', { exact: true }).last()).toBeVisible();
  await page.getByLabel('Return line 1 refund per case in pesos').fill('20');
  await page.screenshot({ path: testInfo.outputPath('supplier-return-controls.png') });
  await confirm(page, save, false);
  expect((await data.snapshot()).suppliers.some(s => s.name === supplierName)).toBe(false);
  await confirm(page, save);
  await expect(activeText(page, 'Supplier order saved. Inventory updated.')).toBeVisible();
  const details = page.getByRole('button', { name: new RegExp(`View ${supplierName} supplier order`) });
  await expect(details).toBeVisible();
  const snapshot = await data.snapshot(), supplier = snapshot.suppliers.find(s => s.name === supplierName);
  expect(supplier).toMatchObject({ contact: '09123', address: 'Warehouse' });
  const product = snapshot.products.find(p => p.name === name);
  expect(product.supplierId).toBe(supplier.id); expect(product.casePackIds).toEqual(['B']);
  expect(product.stockByCasePack.B.totalStock).toBe(0.5);
  expect(snapshot.restockRecords.find(r => r.supplier === supplierName)).toMatchObject({ totalProductCost: 40, totalReturnedCredit: 10, netCost: 30 });
  await details.click(); await expect(page.getByLabel('Close supplier order details')).toBeVisible();
});

test('supplier receipt saves a new supplier and multiple new products without case returns', async ({ page, request }) => {
  const data = await business(request), supplierName = unique('No Return Depot');
  const productNames = ['No Return Soda', 'No Return Water', 'No Return Juice'].map(unique);
  await signIn(page); await tab(page, 'Orders'); await createSupplierOrder(page);
  await page.getByRole('button', { name: 'New supplier', exact: true }).click();
  await page.getByLabel('New supplier name', { exact: true }).fill(supplierName);
  await page.getByRole('button', { name: 'Use supplier in this order' }).click();
  for (const productName of productNames) {
    await newReceiptProduct(page, productName);
    await page.getByLabel(`${productName} quantity in cases`, { exact: true }).fill('0.5');
    await page.getByLabel(`${productName} supplier cost per case in pesos`, { exact: true }).fill('80');
  }
  await confirm(page, () => page.getByRole('button', { name: 'Save supplier order' }).click());
  await expect(activeText(page, 'Supplier order saved. Inventory updated.')).toBeVisible();
  const snapshot = await data.snapshot();
  const savedProducts = snapshot.products.filter(product => productNames.includes(product.name));
  expect(savedProducts).toHaveLength(3);
  for (const product of savedProducts) expect(product.casePackIds).toEqual(['B']);
  expect(snapshot.restockRecords.find(record => record.supplier === supplierName)).toMatchObject({ totalProductCost: 120, totalReturnedCredit: 0, netCost: 120, returnedCases: [] });
});

test('existing supplier can receive a new product and remove then re-add a draft product', async ({ page, request }) => {
  const data = await business(request), name = unique('Case Receipt');
  await signIn(page); await tab(page, 'Orders'); await createSupplierOrder(page); await selectSupplier(page, data.supplierName);
  await newReceiptProduct(page, name);
  await page.getByRole('button', { name: `Remove ${name} Case`, exact: true }).click();
  await expect(activeText(page, 'No products added')).toBeVisible();
  await newReceiptProduct(page, name);
  await page.getByLabel(`${name} quantity in cases`, { exact: true }).fill('0.5');
  await page.getByLabel(`${name} supplier cost per case in pesos`, { exact: true }).fill('80');
  await confirm(page, () => page.getByRole('button', { name: 'Save supplier order' }).click());
  await expect(page.getByRole('button', { name: new RegExp(`View ${data.supplierName} supplier order`) })).toBeVisible();
  const snapshot = await data.snapshot();
  expect(snapshot.products.filter(p => p.name === name)).toHaveLength(1);
  expect(snapshot.products.find(p => p.name === name).stockByCasePack.B.totalStock).toBe(0.5);
});

test('rejected supplier receipt keeps draft available for correction and retry', async ({ page, request }) => {
  const data = await business(request), name = unique('Retry Drink');
  await signIn(page); await tab(page, 'Orders'); await createSupplierOrder(page); await selectSupplier(page, data.supplierName);
  await newReceiptProduct(page, name);
  await page.getByLabel(`${name} quantity in cases`, { exact: true }).fill('0.5');
  await page.getByLabel(`${name} supplier cost per case in pesos`, { exact: true }).fill('80');
  await page.route(`${apiURL}/supplier-orders`, route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Review supplier receipt' }) }), { times: 1 });
  await rejectedSave(page, () => page.getByRole('button', { name: 'Save supplier order' }).click(), /receipt|failed|request/i);
  expect((await data.snapshot()).products.some(p => p.name === name)).toBe(false);
  await expect(page.getByLabel(`${name} quantity in cases`, { exact: true })).toHaveValue('0.5');
  await confirm(page, () => page.getByRole('button', { name: 'Save supplier order' }).click());
  await expect(page.getByRole('button', { name: new RegExp(`View ${data.supplierName} supplier order`) })).toBeVisible();
  expect((await data.snapshot()).products.filter(p => p.name === name)).toHaveLength(1);
});
