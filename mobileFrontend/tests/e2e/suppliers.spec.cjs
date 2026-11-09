const { test, expect } = require('@playwright/test');
const { business, signIn, tab, confirm, preparePage, activeText } = require('./helpers.cjs');
test.beforeEach(preparePage);
async function addLine(page, name) {
  await page.getByRole('button', { name: /Add product/ }).click();
  await page.getByRole('button').filter({ has: page.getByText(new RegExp(`^${name} · `)) }).click();
}

test('supplier order validates empty/quarter-case lines and product picker can close or remove a line', async ({ page, request }) => {
  const data = await business(request);
  const product = (await data.snapshot()).products.find(p => p.id === data.product.id);
  const second = `Valid ${data.product.name}`;
  await data.post('/products', { name: second, supplierId: product.supplierId, packs: [{ packId: 'B', casePrice: 100 }] });
  await signIn(page); await tab(page, 'Orders');
  await page.getByRole('button', { name: new RegExp(data.supplierName) }).click();
  await page.getByRole('button', { name: 'Save supplier order' }).click();
  await expect(activeText(page, 'Add at least one product line before saving.')).toBeVisible();
  await page.getByRole('button', { name: /Add product/ }).click();
  await page.getByLabel('Close product list').click();
  await addLine(page, data.product.name);
  await page.getByLabel(`${data.product.name} quantity in cases`, { exact: true }).fill('0.25');
  await page.getByLabel(`${data.product.name} supplier cost per case in pesos`, { exact: true }).fill('100');
  await addLine(page, second);
  await page.getByLabel(`${second} quantity in cases`, { exact: true }).fill('1');
  await page.getByLabel(`${second} supplier cost per case in pesos`, { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save supplier order' }).click();
  await expect(activeText(page, 'Enter a half-case quantity and purchase cost for every product line.')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Remove ${data.product.name}`) }).click();
  await page.getByRole('button', { name: new RegExp(`Remove ${second}`) }).click();
  await expect(activeText(page, 'No products added')).toBeVisible();
});

test('multi-product supplier receipts deduct named returned-case credits and show historical details', async ({ page, request }) => {
  const data = await business(request), saved = (await data.snapshot()).products.find(p => p.id === data.product.id);
  const secondName = `Second ${data.product.name}`;
  await data.post('/products', { name: secondName, supplierId: saved.supplierId, packs: [{ packId: 'B', casePrice: 200 }] });
  await signIn(page); await tab(page, 'Orders');
  await page.getByRole('button', { name: new RegExp(data.supplierName) }).click();
  await page.getByRole('button', { name: /Add product/ }).click();
  await page.getByRole('button').filter({ has: page.getByText(new RegExp(`^${data.product.name} · `)) }).click();
  await page.getByLabel(`${data.product.name} quantity in cases`, { exact: true }).fill('1');
  await page.getByLabel(`${data.product.name} supplier cost per case in pesos`, { exact: true }).fill('100');
  await addLine(page, secondName);
  await page.getByLabel(`${secondName} quantity in cases`, { exact: true }).fill('0.5');
  await page.getByLabel(`${secondName} supplier cost per case in pesos`, { exact: true }).fill('200');
  for (const [index, [name, price]] of [['Bottle crate',15], ['Water jug',20], ['Soda crate',18], ['Beer crate',12]].entries()) {
    const line = index + 1;
    await page.getByRole('button', { name: /Add return line/ }).click();
    await page.getByLabel(`Return line ${line} container or item`, { exact: true }).fill(name);
    await page.getByRole('button', { name: `Increase quantity for return line ${line}`, exact: true }).click();
    await page.getByLabel(`Return line ${line} refund per case in pesos`, { exact: true }).fill(String(price));
  }
  await confirm(page, () => page.getByRole('button', { name: 'Save supplier order' }).click(), false);
  expect((await data.snapshot()).restockRecords.some(r => r.supplier === data.supplierName)).toBe(false);
  await confirm(page, () => page.getByRole('button', { name: 'Save supplier order' }).click());
  const details = page.getByRole('button', { name: new RegExp(`View ${data.supplierName} supplier order`) });
  await details.click();
  await expect(page.getByLabel('Close supplier order details')).toBeVisible();
  const snapshot = await data.snapshot(), receipt = snapshot.restockRecords.find(r => r.supplier === data.supplierName);
  expect(receipt).toMatchObject({ totalProductCost: 200, totalReturnedCredit: 32.5, netCost: 167.5 });
  expect(receipt.returnedCases).toHaveLength(4);
  expect(receipt.returnedCases.map(item => item.type).sort()).toEqual(['Beer crate', 'Bottle crate', 'Soda crate', 'Water jug']);
  expect(snapshot.products.find(p => p.name === secondName).stockByCasePack.B.totalStock).toBe(0.5);
  expect(snapshot.products.find(p => p.id === data.product.id).supplierCosts.B).toBe(100);
  expect(snapshot.products.find(p => p.name === secondName).supplierCosts.B).toBe(200);
  await page.getByLabel('Close supplier order details').click();
  await page.getByRole('button', { name: /Order history/ }).click();
  await page.getByRole('button', { name: 'Date range', exact: true }).click();
  await page.getByLabel('Order history start date', { exact: true }).fill(receipt.date);
  await page.getByLabel('Order history end date', { exact: true }).fill(receipt.date);
  await page.getByRole('button', { name: data.supplierName, exact: true }).click();
  await expect(activeText(page, '1 matching order')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`View ${data.supplierName} supplier order from ${receipt.date}`) }).click();
  await expect(page.getByText(data.product.name, { exact: true })).toBeVisible();
  await page.getByLabel('Close supplier order details').click();
});

test('changing supplier with a draft confirms before discarding its product lines', async ({ page, request }) => {
  const data = await business(request), other = await business(request);
  await signIn(page); await tab(page, 'Orders');
  await page.getByRole('button', { name: new RegExp(data.supplierName) }).click();
  await addLine(page, data.product.name);
  const change = () => page.getByRole('button', { name: new RegExp(other.supplierName) }).click();
  await confirm(page, change, false);
  await expect(page.getByLabel(`${data.product.name} quantity in cases`, { exact: true })).toBeVisible();
  await confirm(page, change);
  await expect(activeText(page, 'No products added')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(other.supplierName) })).toHaveAttribute('aria-pressed', 'true');
});
