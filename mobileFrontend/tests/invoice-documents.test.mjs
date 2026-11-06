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

test('PDF HTML escapes return labels and includes deductions without treating them as cash payments', () => {
  const html = invoiceHtml(order, invoice);
  assert.ok(html.includes('A &lt;empty&gt; &amp; crates'));
  assert.ok(!html.includes('A <empty>'));
  assert.match(html, /Container returns<\/span><span>−₱10\.00/);
  assert.match(html, /Grand total<\/span><span>₱190\.00/);
  assert.match(html, /Remaining balance<\/span><span>₱140\.00/);
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
  assert.match(html, /Container deposits<\/span><span>\+₱25\.00/);
  assert.match(html, /Container deposit/);
  const rows = XLSX.utils.sheet_to_json(invoiceWorkbook(depositOrder, invoice).Sheets.Invoice, { header: 1 });
  assert.equal(rows.find(row => row[0] === 'Container deposits')[4], 25);
  assert.equal(rows.find(row => row[0] === 'GRAND TOTAL')[4], 225);
});
