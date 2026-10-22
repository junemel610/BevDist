import test from 'node:test';
import assert from 'node:assert/strict';
import { canMarkDelivered, orderDeliveryStatus, orderLifecycleStatus } from '../src/components/orders/orderLifecycle.js';

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
