import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateAccountPayment, groupOpenCustomerBalances } from '../src/components/balances/customerAccounts.js';

const orders = [
  { id: 'old', date: '2026-06-10' },
  { id: 'new', date: '2026-06-20' },
  { id: 'other', date: '2026-06-01' },
];
const balances = [
  { id: 'b-new', orderId: 'new', customerId: 'c1', customerName: 'Maria', invoiceNumber: 'INV-002', remainingBalance: 500, amountPaid: 100, dueDate: '2026-06-27', status: 'partial' },
  { id: 'b-old', orderId: 'old', customerId: 'c1', customerName: 'Maria', invoiceNumber: 'INV-001', remainingBalance: 300, amountPaid: 200, dueDate: '2026-06-17', status: 'partial' },
  { id: 'b-other', orderId: 'other', customerId: 'c2', customerName: 'Juan', invoiceNumber: 'INV-003', remainingBalance: 125, amountPaid: 0, dueDate: '2026-06-08', status: 'unpaid' },
  { id: 'b-paid', orderId: 'other', customerId: 'c1', customerName: 'Maria', invoiceNumber: 'INV-000', remainingBalance: 0, amountPaid: 100, dueDate: '2026-06-08', status: 'paid' },
  { id: 'b-cancelled', orderId: 'other', customerId: 'c1', customerName: 'Maria', invoiceNumber: 'INV-004', remainingBalance: 0, amountPaid: 0, dueDate: '2026-06-08', status: 'cancelled' },
];

test('customer account groups keep each open invoice separate and order them oldest first', () => {
  const accounts = groupOpenCustomerBalances(balances, orders);
  const maria = accounts.find(account => account.customerId === 'c1');
  assert.equal(maria.outstanding, 800);
  assert.deepEqual(maria.balances.map(balance => balance.id), ['b-old', 'b-new']);
  assert.deepEqual(accounts.map(account => account.customerName), ['Juan', 'Maria']);
});

test('combined payment allocates to oldest invoices first without merging invoice balances', () => {
  const maria = groupOpenCustomerBalances(balances, orders).find(account => account.customerId === 'c1');
  const plan = allocateAccountPayment(maria.balances, orders, 450);
  assert.equal(plan.applied, 450);
  assert.equal(plan.excess, 0);
  assert.deepEqual(plan.allocations, [
    { balanceId: 'b-old', invoiceNumber: 'INV-001', amount: 300 },
    { balanceId: 'b-new', invoiceNumber: 'INV-002', amount: 150 },
  ]);
  assert.equal(balances.find(balance => balance.id === 'b-old').remainingBalance, 300);
  assert.equal(balances.find(balance => balance.id === 'b-new').remainingBalance, 500);
});

test('payment above the account total applies to invoices and leaves excess as customer credit', () => {
  const maria = groupOpenCustomerBalances(balances, orders).find(account => account.customerId === 'c1');
  const plan = allocateAccountPayment(maria.balances, orders, 900);
  assert.equal(plan.applied, 800);
  assert.equal(plan.excess, 100);
  assert.deepEqual(plan.allocations.map(item => item.amount), [300, 500]);
});

test('invalid payment amounts and accounts without open invoices are rejected', () => {
  assert.equal(allocateAccountPayment(balances, orders, 0).valid, false);
  assert.equal(allocateAccountPayment([balances[3], balances[4]], orders, 50).valid, false);
});
