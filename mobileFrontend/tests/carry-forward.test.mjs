import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePayment, carryForwardBalances, forwardBalanceRecords } from '../src/components/balances/carryForward.js';

test('only open balances for this customer move to the next invoice', () => {
  const balances = [
    { id: 'b1', customerId: 'c1', customerName: 'Maria', remainingBalance: 300 },
    { id: 'b2', customerName: ' maria ', remainingBalance: 200 },
    { id: 'b3', customerId: 'c2', customerName: 'Maria', remainingBalance: 100 },
    { id: 'b4', customerId: 'c1', customerName: 'Maria', remainingBalance: 50, carriedForwardToOrderId: 'o2' },
  ];
  assert.deepEqual(carryForwardBalances(balances, { id: 'c1', name: 'Maria' }), {
    items: [{ balanceId: 'b1', amount: 300 }, { balanceId: 'b2', amount: 200 }], amount: 500,
  });
});

test('forwarded debt is cleared from the prior balance and linked to the new order', () => {
  const next = forwardBalanceRecords([{ id: 'b1', remainingBalance: 300 }], [{ balanceId: 'b1', amount: 300 }], 'o2');
  assert.equal(next[0].remainingBalance, 0);
  assert.equal(next[0].status, 'carried_forward');
  assert.equal(next[0].carriedForwardToOrderId, 'o2');
});

test('payments settle carried debt before the current invoice amount', () => {
  assert.deepEqual(allocatePayment({ carriedForwardAmount: 300, carriedForwardPaid: 100, currentInvoicePaid: 0 }, 250), {
    carriedForwardPaid: 300, currentInvoicePaid: 50,
  });
});
