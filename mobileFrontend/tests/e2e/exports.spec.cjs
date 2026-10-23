const { test, expect } = require('@playwright/test');
const XLSX = require('@redoper1/xlsx-js-style');
const { business, signIn, preparePage, openInvoice } = require('./helpers.cjs');
test.beforeEach(preparePage);
async function preview(page, request) {
  const data = await business(request), invoice = await data.invoice(1.5, { containerReturns: [{ type: 'Empty A', quantity: 0.5, refundPerCase: 20 }] });
  await signIn(page); const order = await openInvoice(page, data, invoice.id);
  await page.getByText('Preview / export invoice', { exact: true }).click();
  return { data, order };
}

test('Excel action downloads a styled workbook with the selected customer, case quantity and refund', async ({ page, request }) => {
  const { data, order } = await preview(page, request);
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: `Export ${order.invoiceNumber} as Excel` }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe(`invoice-${order.invoiceNumber}.xlsx`);
  const workbook = XLSX.readFile(await download.path(), { cellStyles: true }), sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  for (const text of [data.customer.name, data.product.name, order.invoiceNumber, 'Empty A', '140', '1.5']) expect(csv).toContain(text);
  expect(sheet['!merges'].length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page.getByLabel('Payment received in pesos')).toHaveValue('0');
  await page.getByLabel('Close payment form').click();
});

test('PDF print action opens only the formatted invoice rather than printing app navigation', async ({ page, context, request }, testInfo) => {
  // Stub only the OS print dialog; inspect the actual HTML opened by the export button.
  await context.addInitScript(() => { window.print = () => { window.__printedInvoice = Boolean(document.querySelector('table')); }; });
  const { data, order } = await preview(page, request);
  const waiting = page.waitForEvent('popup', { timeout: 10000 });
  await page.getByRole('button', { name: `Export ${order.invoiceNumber} as PDF` }).click();
  const print = await waiting;
  await expect(print.getByRole('heading', { name: 'BevDist Distribution Co.' })).toBeVisible();
  await expect(print.getByText(data.customer.name, { exact: true })).toBeVisible();
  await expect(print.getByRole('cell', { name: data.product.name, exact: true })).toBeVisible();
  await expect.poll(() => print.evaluate(() => window.__printedInvoice)).toBe(true);
  await expect(print.getByRole('tab')).toHaveCount(0);
  const pdf = await print.pdf({ path: testInfo.outputPath('invoice.pdf'), format: 'A4', printBackground: true });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await testInfo.attach('Browser invoice PDF', { path: testInfo.outputPath('invoice.pdf'), contentType: 'application/pdf' });
  await print.close();
});

test('blocked PDF popups show an actionable error and the preview stays available', async ({ page, request }) => {
  await page.addInitScript(() => { window.open = () => null; });
  const { order } = await preview(page, request);
  const waiting = page.waitForEvent('dialog');
  const clicked = page.getByRole('button', { name: `Export ${order.invoiceNumber} as PDF` }).click();
  const alert = await waiting;
  expect(alert.message()).toContain('Allow pop-ups');
  await alert.dismiss();
  await clicked;
  await expect(page.getByRole('button', { name: `Export ${order.invoiceNumber} as Excel` })).toBeEnabled();
});
