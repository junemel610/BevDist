import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '@redoper1/xlsx-js-style';
import { invoiceHtml, invoiceWorkbook } from '../src/components/orders/invoiceDocuments.js';

const order = {
  invoiceNumber: 'INV-TEST', date: '2026-10-24', customer: { name: 'Store <One>', address: 'Street' },
  items: [{ productName: 'Beverage', packLabel: 'A', quantity: 2, casePrice: 100 }],
  containerReturns: [{ kind: 'return', type: 'A <empty> & crates', quantity: 0.5, amountPerCase: 20, refundPerCase: 20, amountTotal: 10, refundTotal: 10 }],
  subtotal: 200, containerDepositTotal: 0, containerRefundTotal: 10, grandTotal: 190,
};
const invoice = { invoiceNumber: order.invoiceNumber, amountPaid: 50, remainingBalance: 140, status: 'partial' };

test('PDF uses the paper invoice layout and escapes customer and return labels', () => {
  const html = invoiceHtml(order, invoice);
  assert.ok(html.includes('A &lt;empty&gt; &amp; crates'));
  assert.ok(!html.includes('A <empty>'));
  assert.ok(html.includes('Store &lt;One&gt;'));
  assert.match(html, /Mila's Store/);
  assert.match(html, /\.business[^}]*text-align:center/);
  assert.match(html, /737 San Diego St/);
  assert.match(html, /Sampaloc, Manila, 1008/);
  assert.match(html, /CP 09569569553, TEL: 856-70568/);
  assert.match(html, /INV:<\/span><span class="meta-line">INV-TEST/);
  assert.match(html, /Date:<\/span><span class="meta-line date-line">2026-10-24/);
  assert.match(html, /Customer Name:/);
  assert.match(html, /Tel No:/);
  assert.match(html, /Address:/);
  assert.match(html, /<th>Product<\/th><th>QTY<\/th><th>PRICE<\/th>/);
  assert.match(html, /Return · ₱20\.00 per case/);
  assert.match(html, /−₱10\.00/);
  assert.match(html, /GRAND TOTAL<\/span><strong>₱190\.00/);
  assert.ok(!html.includes('Remaining balance'));
});

test('styled Excel serializes return lines, numeric deductions, totals, and valid summary merges', () => {
  for (const count of [0, 1, 3]) {
    const data = { ...order, containerReturns: Array.from({ length: count }, () => order.containerReturns[0]), containerRefundTotal: count * 10, grandTotal: 200 - count * 10 };
    const workbook = invoiceWorkbook(data, invoice);
    const sheet = workbook.Sheets.Invoice;
    const roundtrip = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(roundtrip.Sheets.Invoice, { header: 1 });
    assert.equal(rows.filter(row => String(row[0]).startsWith('Returned:')).length, count);
    assert.equal(rows.find(row => row[0] === 'Container returns')[4], (count ? -count * 10 : 0));
    assert.equal(rows.find(row => row[0] === 'GRAND TOTAL')[4], 200 - count * 10);
    const totalRow = rows.findIndex(row => row[0] === 'GRAND TOTAL');
    // sheet_to_json retains blank rows in array mode, so its row indexes match sheet coordinates.
    assert.equal(sheet[`A${totalRow + 1}`].s.fill.fgColor.rgb, 'FF1E3A8A');
    assert.ok(sheet['!merges'].some(range => range.s.r === totalRow && range.e.c === 3));
  }
});

test('invoice exports show deposits as additions to the invoice total', () => {
  const depositOrder = {
    ...order,
    containerReturns: [{ kind: 'deposit', type: 'Bottle crate', quantity: 0.5, amountPerCase: 50, amountTotal: 25 }],
    containerDepositTotal: 25,
    containerRefundTotal: 0,
    grandTotal: 225,
  };
  const html = invoiceHtml(depositOrder, { ...invoice, remainingBalance: 175 });
  assert.match(html, /Deposit · ₱50\.00 per case/);
  assert.match(html, /\+₱25\.00/);
  assert.match(html, /GRAND TOTAL<\/span><strong>₱225\.00/);
  const rows = XLSX.utils.sheet_to_json(invoiceWorkbook(depositOrder, invoice).Sheets.Invoice, { header: 1 });
  assert.equal(rows.find(row => row[0] === 'Container deposits')[4], 25);
  assert.equal(rows.find(row => row[0] === 'GRAND TOTAL')[4], 225);
});
