import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareContainerReturns } from '../src/components/orders/containerReturns.js';
import { createLiveData } from '../src/api/liveData.js';

const row = { type: ' A empty case ', quantity: '0.5', refundPerCase: '12.25' };

test('container returns use half cases, round each deduction, and reduce the total', () => {
  const result = prepareContainerReturns([row, { ...row, type: 'B' }], 100);
  assert.equal(result.refund, 12.26);
  assert.equal(result.total, 87.74);
  assert.deepEqual(result.entries[0], { type: 'A empty case', quantity: 0.5, refundPerCase: 12.25 });
  assert.equal(prepareContainerReturns([], 100).total, 100);
  assert.equal(prepareContainerReturns([{ ...row, quantity: 1.5, refundPerCase: '0.29' }], 100).refund, 0.44);
});

test('invalid return rows, excessive deductions, and reductions below settlements are rejected', () => {
  for (const change of [{ type: '' }, { quantity: '0.25' }, { quantity: '0' }, { quantity: '-0.5' }, { refundPerCase: '' }, { refundPerCase: '-1' }, { refundPerCase: '1.001' }]) {
    assert.ok(prepareContainerReturns([{ ...row, ...change }], 100).error);
  }
  assert.match(prepareContainerReturns([row], 1).error, /exceed/);
  assert.match(prepareContainerReturns([row], 100, 95).error, /payments and credit/);
  assert.equal(prepareContainerReturns([{ ...row, refundPerCase: 200 }], 100).total, 0);
});

test('create sends normalized returns; explicit empty edit clears them and omitted edit preserves them', async () => {
  const calls = [];
  const api = { invoicesAPI: {
    create: async input => { calls.push(input); return { data: { id: 'invoice' } }; },
    update: async (id, input) => { calls.push(input); return { data: { id } }; },
  } };
  const live = createLiveData(api, () => 'request-key');
  const entries = prepareContainerReturns([row], 100).entries;
  const items = [{ productId: 'product', packId: 'A', quantity: 1 }];
  await live.createOrder({ id: 'customer' }, items, entries);
  assert.deepEqual(calls[0].containerReturns, entries);
  await live.editInvoice('invoice', items, []);
  assert.deepEqual(calls[1].containerReturns, []);
  await live.editInvoice('invoice', items);
  assert.equal('containerReturns' in calls[2], false);
});
