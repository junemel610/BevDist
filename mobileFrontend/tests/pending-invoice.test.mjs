import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePendingInvoice, invoiceEditorProducts } from '../src/components/orders/pendingInvoice.js';

const product = {
  id: 'p1',
  casePackIds: ['A'],
  stockByCasePack: { A: { totalStock: 5, reservedStock: 1 } },
};
const order = {
  id: 'o1',
  status: 'pending',
  deliveryStatus: 'pending',
  items: [{ productId: 'p1', packId: 'A', quantity: 1, stockQuantity: 1, casePrice: 100 }],
};
const balance = { orderId: 'o1', amountPaid: 20, remainingBalance: 80, dueDate: '2999-01-01', status: 'partial' };
const line = quantity => ({ productId: 'p1', packId: 'A', quantity, stockQuantity: quantity, casePrice: 100 });

test('editing a pending invoice updates its balance and replaces its stock reservation', () => {
  const result = updatePendingInvoice([product], order, balance, [line(2.5)]);
  assert.equal(result.error, undefined);
  assert.equal(result.products[0].stockByCasePack.A.reservedStock, 2.5);
  assert.equal(result.order.grandTotal, 250);
  assert.equal(result.balance.totalAmount, 250);
  assert.equal(result.balance.remainingBalance, 230);
});

test('pending invoice edits cannot reserve stock held by other invoices', () => {
  const lowStock = { ...product, stockByCasePack: { A: { totalStock: 5, reservedStock: 4.5 } } };
  const result = updatePendingInvoice([lowStock], order, balance, [line(2)]);
  assert.match(result.error, /available stock/);
});

test('pending invoice edits cannot reduce total below payments already recorded', () => {
  const result = updatePendingInvoice([product], order, { ...balance, amountPaid: 150 }, [line(1)]);
  assert.match(result.error, /lower than payments/);
});

test('completed and delivered invoices cannot be edited', () => {
  const result = updatePendingInvoice([product], { ...order, status: 'completed' }, balance, [line(2)]);
  assert.match(result.error, /Only pending/);
});

test('editing items preserves the container deduction and net balance', () => {
  const result = updatePendingInvoice([product], { ...order, containerRefundTotal: 30 }, balance, [line(2)]);
  assert.equal(result.order.subtotal, 200);
  assert.equal(result.order.grandTotal, 170);
  assert.equal(result.balance.remainingBalance, 150);
});

test('the live invoice editor shows retained prices while new packs use current catalog prices', () => {
  const catalog = [{ id: 'p1', casePrices: { A: 150, B: 200 } }];
  const shown = invoiceEditorProducts(catalog, { items: [{ productId: 'p1', packId: 'A', casePrice: 100 }] });
  assert.deepEqual(shown[0].casePrices, { A: 100, B: 200 });
  assert.equal(catalog[0].casePrices.A, 150);
  assert.equal(invoiceEditorProducts(catalog, null), catalog);
});
