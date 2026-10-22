import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/dashboard/salesSummary.js', import.meta.url), 'utf8');
const { salesSummary } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

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
    fullyPaid: 2,
  });
});

test('partial payments count toward actual sales and leave a balance due', () => {
  assert.deepEqual(salesSummary(
    [{ id: 'order', status: 'pending', grandTotal: 1000 }],
    [{ orderId: 'order', amountPaid: 300 }],
  ), { expected: 1000, actual: 300, outstanding: 700, fullyPaid: 0 });
});
