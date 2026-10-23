import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyAppliedPayments } from '../src/components/dashboard/salesSummary.js';

test('daily payments separate Cash, GCash and Bank Transfer, counting only applied amounts', () => {
  const orders = [{ id: 'invoice', status: 'pending' }, { id: 'cancelled', status: 'cancelled' }];
  const balances = [{ id: 'balance', orderId: 'invoice' }, { id: 'void', orderId: 'cancelled', status: 'cancelled' }];
  const base = { orderId: 'invoice', balanceId: 'balance', date: '2026-10-24', amountApplied: 100, amountReceived: 150, excess: 50 };
  const payments = [
    ...['Cash', 'GCash', 'Bank Transfer'].map((method, index) => ({ ...base, method, amountApplied: (index + 1) * 100 })),
    { ...base, method: 'Cash', date: '2026-10-23' },
    { ...base, method: 'GCash', orderId: 'cancelled', balanceId: 'void' },
    { ...base, method: 'Bank Transfer', balanceId: 'missing' },
    { ...base, method: 'Cash', amountApplied: NaN },
  ];
  assert.deepEqual(dailyAppliedPayments(orders, balances, payments, '2026-10-24'), { Cash: 100, GCash: 200, 'Bank Transfer': 300 });
  assert.deepEqual(dailyAppliedPayments([], [], [], '2026-10-24'), { Cash: 0, GCash: 0, 'Bank Transfer': 0 });
});
