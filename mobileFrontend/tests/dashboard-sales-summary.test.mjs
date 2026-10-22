import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceSummary, salesSummary } from '../src/components/dashboard/salesSummary.js';

test('counts invoice totals and excludes cancelled orders and excess payments', () => {
  const orders = [
    { id: 'partial', status: 'pending', grandTotal: 5248 },
    { id: 'paid', status: 'completed', grandTotal: 1000 },
    { id: 'cancelled', status: 'cancelled', grandTotal: 400 },
  ];
  const balances = [
    { orderId: 'partial', amountPaid: 5500 },
    { orderId: 'paid', amountPaid: 1000 },
  ];

  assert.deepEqual(salesSummary(orders, balances), {
    expected: 6248,
    actual: 6248,
    outstanding: 0,
    outstandingInvoices: 0,
    fullyPaid: 2,
    completedOrders: 1,
  });
});

test('partial payments count toward actual sales and leave a balance due', () => {
  assert.deepEqual(salesSummary(
    [{ id: 'order', status: 'pending', grandTotal: 1000 }],
    [{ orderId: 'order', amountPaid: 300 }],
  ), { expected: 1000, actual: 300, outstanding: 700, outstandingInvoices: 1, fullyPaid: 0, completedOrders: 0 });
});

test('cash is included in actual sales while GCash stays in its separate total', () => {
  const summary = salesSummary(
    [{ id: 'cash-order', status: 'pending', grandTotal: 1000 }, { id: 'gcash-order', status: 'pending', grandTotal: 800 }],
    [{ orderId: 'cash-order', amountPaid: 500 }, { orderId: 'gcash-order', amountPaid: 400 }],
    [
      { orderId: 'cash-order', method: 'Cash', amountApplied: 500, excess: 30 },
      { orderId: 'gcash-order', method: 'GCash', amountApplied: 400, excess: 0 },
    ],
  );
  assert.equal(summary.actual, 500);
  assert.equal(summary.expected, 1800);
});

test('older and newer customer invoices remain separate in sales and outstanding totals', () => {
  const orders = [
    { id: 'old', status: 'pending', grandTotal: 500 },
    { id: 'new', status: 'pending', grandTotal: 800 },
  ];
  const balances = [
    { orderId: 'old', totalAmount: 500, amountPaid: 100, remainingBalance: 400, status: 'partial' },
    { orderId: 'new', totalAmount: 800, amountPaid: 0, remainingBalance: 800, status: 'unpaid' },
  ];
  const summary = salesSummary(orders, balances, []);
  assert.equal(summary.expected, 1300);
  assert.equal(summary.outstanding, 1200);
  assert.equal(invoiceSummary(orders[0], balances[0]).status, 'partial');
  assert.equal(invoiceSummary(orders[1], balances[1]).status, 'unpaid');
});

test('invoice status distinguishes unpaid, partial, paid, and cancelled', async () => {
  const order = { id: 'order', orderNumber: 'ORD-2026-007', grandTotal: 1000, deposit: 0, status: 'pending' };
  assert.equal(invoiceSummary(order, null).status, 'unpaid');
  assert.equal(invoiceSummary(order, { amountPaid: 250 }).status, 'partial');
  assert.equal(invoiceSummary(order, { amountPaid: 1000 }).status, 'paid');
  assert.equal(invoiceSummary({ ...order, status: 'cancelled' }, null).status, 'cancelled');
  assert.equal(invoiceSummary(order, null).invoiceNumber, 'INV-2026-007');
});
