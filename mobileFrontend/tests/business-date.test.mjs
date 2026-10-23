import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDate } from '../src/utils/businessDate.js';
import { salesTrends } from '../src/components/dashboard/salesSummary.js';

test('daily cash updates from the latest ledger and uses Manila day and month boundaries', () => {
  const now = new Date('2026-10-31T17:00:00Z');
  assert.equal(businessDate(now), '2026-11-01');
  const orders = [{ id: 'invoice', status: 'pending' }], balances = [{ id: 'balance', orderId: 'invoice' }];
  const cash = { orderId: 'invoice', balanceId: 'balance', method: 'Cash', amountApplied: 50, date: '2026-11-01' };
  assert.equal(salesTrends(orders, balances, [], now).daily.at(-1).value, 0);
  const updated = salesTrends(orders, balances, [cash, { ...cash, method: 'GCash', amountApplied: 500 }], now);
  assert.equal(updated.daily.at(-1).value, 50);
  assert.equal(updated.monthly.at(-1).value, 50);
  assert.equal(updated.monthly.at(-1).label, 'Nov');
});
