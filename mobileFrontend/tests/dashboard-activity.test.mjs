import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/components/dashboard/recentOrders.js', import.meta.url), 'utf8');
const { recentOrders } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('recent activity orders dates newest first without mutating context', () => {
  const orders = [{ id: 'old', date: '2026-06-14' }, { id: 'new', date: '2026-06-18' }, { id: 'newer-entry', date: '2026-06-18' }];
  const before = structuredClone(orders);
  assert.deepEqual(recentOrders(orders, 2).map(order => order.id), ['newer-entry', 'new']);
  assert.deepEqual(orders, before);
  assert.deepEqual(recentOrders([]), []);
});
