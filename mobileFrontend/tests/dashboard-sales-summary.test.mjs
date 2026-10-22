import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceSummary, salesSummary, salesTrends } from '../src/components/dashboard/salesSummary.js';
import { INITIAL_BALANCES, INITIAL_ORDERS, INITIAL_PAYMENT_TRANSACTIONS } from '../src/data/initialData.js';

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
    [{ id: 'cash-balance', orderId: 'cash-order', amountPaid: 500 }, { id: 'gcash-balance', orderId: 'gcash-order', amountPaid: 400 }],
    [
      { balanceId: 'cash-balance', orderId: 'cash-order', method: 'Cash', amountApplied: 500, excess: 30 },
      { balanceId: 'gcash-balance', orderId: 'gcash-order', method: 'GCash', amountApplied: 400, excess: 0 },
    ],
  );
  assert.equal(summary.actual, 500);
  assert.equal(summary.expected, 1800);
});

test('dashboard uses invoice totals and only linked, applied cash payments', () => {
  const summary = salesSummary(
    [{ id: 'invoice', status: 'pending', grandTotal: 1000 }],
    [{ id: 'invoice-balance', orderId: 'invoice', totalAmount: 1000, amountPaid: 300, remainingBalance: 700 }],
    [
      { balanceId: 'invoice-balance', orderId: 'invoice', method: 'Cash', amountApplied: 300 },
      { orderId: 'missing-invoice', method: 'Cash', amountApplied: 500 },
      { balanceId: 'invoice-balance', orderId: 'invoice', method: 'Cash', amountApplied: Infinity },
      { balanceId: 'wrong-balance', orderId: 'invoice', method: 'Cash', amountApplied: 250 },
    ],
  );
  assert.deepEqual(summary, {
    expected: 1000,
    actual: 300,
    outstanding: 700,
    outstandingInvoices: 1,
    fullyPaid: 0,
    completedOrders: 0,
  });
});

test('cash trends use applied payments, skip cancelled and non-cash invoices, and fill missing dates', () => {
  const trends = salesTrends(
    [
      { id: 'cash', status: 'pending' },
      { id: 'gcash', status: 'pending' },
      { id: 'cancelled', status: 'cancelled' },
    ],
    [
      { id: 'cash-balance', orderId: 'cash' },
      { id: 'gcash-balance', orderId: 'gcash' },
      { id: 'cancelled-balance', orderId: 'cancelled' },
    ],
    [
      { balanceId: 'cash-balance', orderId: 'cash', method: 'Cash', amountApplied: 200, date: '2026-10-22' },
      { balanceId: 'gcash-balance', orderId: 'gcash', method: 'GCash', amountApplied: 300, date: '2026-10-22' },
      { balanceId: 'cancelled-balance', orderId: 'cancelled', method: 'Cash', amountApplied: 400, date: '2026-10-22' },
      { orderId: 'missing', method: 'Cash', amountApplied: 500, date: '2026-10-22' },
      { balanceId: 'cash-balance', orderId: 'cash', method: 'Cash', amountApplied: 100, date: '2026-06-01' },
    ],
    '2026-10-22',
  );
  assert.equal(trends.daily.length, 7);
  assert.deepEqual(trends.daily.map(day => day.value), [0, 0, 0, 0, 0, 0, 200]);
  assert.equal(trends.monthly.length, 6);
  assert.deepEqual(trends.monthly.map(month => month.label), ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  assert.equal(trends.monthly[1].value, 100);
  assert.equal(trends.monthly[5].value, 200);
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

test('seed dashboard totals reconcile to invoices, cash applications, and open balances', () => {
  assert.deepEqual(salesSummary(INITIAL_ORDERS, INITIAL_BALANCES, INITIAL_PAYMENT_TRANSACTIONS), {
    expected: 2784,
    actual: 2156,
    outstanding: 628,
    outstandingInvoices: 2,
    fullyPaid: 2,
    completedOrders: 2,
  });
  const trends = salesTrends(INITIAL_ORDERS, INITIAL_BALANCES, INITIAL_PAYMENT_TRANSACTIONS, '2026-10-22');
  assert.deepEqual(trends.daily.map(item => item.value), [0, 0, 0, 500, 924, 300, 432]);
  assert.deepEqual(trends.monthly.map(item => item.value), [0, 0, 0, 0, 0, 2156]);
});
