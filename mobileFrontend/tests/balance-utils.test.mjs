import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceStatus, creditAppliedToInvoice, customerCreditKey, paymentBreakdown } from '../src/components/balances/balanceUtils.js';

test('balance status follows remaining amount and due date', () => {
  assert.equal(balanceStatus({ remainingBalance: 0, dueDate: '2026-01-01' }, '2026-02-01'), 'paid');
  assert.equal(balanceStatus({ remainingBalance: 20, dueDate: '2026-02-02' }, '2026-02-01'), 'unpaid');
  assert.equal(balanceStatus({ remainingBalance: 20, dueDate: '2026-01-31' }, '2026-02-01'), 'overdue');
});

test('payments apply only what is due and carry excess forward', () => {
  const balance = { remainingBalance: 650 };
  assert.deepEqual(paymentBreakdown(balance, 500), { valid: true, applied: 500, excess: 0 });
  assert.deepEqual(paymentBreakdown(balance, 700), { valid: true, applied: 650, excess: 50 });
  assert.deepEqual(paymentBreakdown(balance, 0), { valid: false, applied: 0, excess: 0 });
  assert.deepEqual(paymentBreakdown(balance, -5), { valid: false, applied: 0, excess: 0 });
});

test('customer credit matches names and applies up to a new invoice total', () => {
  assert.equal(customerCreditKey('  Maria Santos '), customerCreditKey('maria santos'));
  assert.equal(creditAppliedToInvoice(250, 200), 200);
  assert.equal(creditAppliedToInvoice(150, 200), 150);
  assert.equal(creditAppliedToInvoice(-1, 200), 0);
});
