import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_METHOD } from '../src/types/index.js';
import { createPaymentTransaction } from '../src/components/balances/paymentLedger.js';

test('payment records separate amount received, applied sales, and excess credit', () => {
  const transaction = createPaymentTransaction(
    { id: 'b1', orderId: 'o1', customerId: 'c1', customerName: 'Maria', invoiceNumber: 'INV-1', remainingBalance: 5248 },
    null,
    5500,
    PAYMENT_METHOD.CASH,
    'pay-1',
  );
  assert.equal(transaction.amountReceived, 5500);
  assert.equal(transaction.amountApplied, 5248);
  assert.equal(transaction.excess, 252);
  assert.equal(transaction.method, 'Cash');
});

test('payment ledger rejects unsupported methods and non-payments', () => {
  const balance = { id: 'b1', remainingBalance: 100 };
  assert.equal(createPaymentTransaction(balance, null, 20, 'Cheque'), null);
  assert.equal(createPaymentTransaction(balance, null, 0, PAYMENT_METHOD.GCASH), null);
});
