import test from 'node:test';
import assert from 'node:assert/strict';
import { canMarkDelivered, orderDeliveryStatus, orderLifecycleStatus, finalizeReservedStock } from '../src/components/orders/orderLifecycle.js';

test('an invoice completes only when delivered and fully paid', () => {
  const order = { status: 'pending', deliveryStatus: 'delivered' };
  assert.equal(orderLifecycleStatus(order, 'partial'), 'pending');
  assert.equal(orderLifecycleStatus(order, 'paid'), 'completed');
  assert.equal(orderLifecycleStatus({ ...order, deliveryStatus: 'pending' }, 'paid'), 'pending');
});

test('cancelled invoices remain cancelled and cannot be marked delivered', () => {
  const order = { status: 'cancelled' };
  assert.equal(orderLifecycleStatus(order, 'paid'), 'cancelled');
  assert.equal(canMarkDelivered(order), false);
});

test('legacy completed records are treated as delivered', () => {
  assert.equal(orderDeliveryStatus({ status: 'completed' }), 'delivered');
});

test('unpaid delivery deducts physical and reserved stock while staying pending', () => {
  const products = [{ id: 'p1', casePackIds: ['A','B'], stockByCasePack: {
    A: { totalStock: 5, reservedStock: 1.5 }, B: { totalStock: 3, reservedStock: 0 },
  } }];
  const order = { status: 'pending', deliveryStatus: 'pending', items: [{ productId: 'p1', packId: 'A', quantity: 1.5 }] };
  const updated = finalizeReservedStock(products, order);
  assert.deepEqual(updated[0].stockByCasePack.A, { totalStock: 3.5, reservedStock: 0 });
  assert.equal(updated[0].stockByCasePack.B, products[0].stockByCasePack.B);
  const delivered = { ...order, deliveryStatus: 'delivered' };
  assert.equal(orderLifecycleStatus(delivered, 'partial'), 'pending');
  assert.equal(canMarkDelivered(delivered), false);
  assert.equal(orderLifecycleStatus(delivered, 'paid'), 'completed');
});
