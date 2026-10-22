import test from 'node:test';
import assert from 'node:assert/strict';
import { hasValidSupplierOrderItems, supplierOrderTotals } from '../src/components/supplierOrders/supplierOrderUtils.js';

test('supplier order totals subtract returned-case credits and never go below zero', () => {
  assert.deepEqual(supplierOrderTotals(
    [{ quantity: 3, unitCost: 40.25 }],
    [{ quantity: 2, creditPerUnit: 10 }],
  ), { productCost: 120.75, returnCredit: 20, netCost: 100.75 });
  assert.deepEqual(supplierOrderTotals(
    [{ quantity: 1, unitCost: 10 }],
    [{ quantity: 2, creditPerUnit: 15 }],
  ), { productCost: 10, returnCredit: 30, netCost: 0 });
});

test('supplier orders accept half-case steps and require a positive case cost', () => {
  assert.equal(hasValidSupplierOrderItems([{ quantity: 2, unitCost: 10 }]), true);
  assert.equal(hasValidSupplierOrderItems([{ quantity: 1.5, unitCost: 10 }]), true);
  assert.equal(hasValidSupplierOrderItems([{ quantity: 0, unitCost: 10 }]), false);
  assert.equal(hasValidSupplierOrderItems([{ quantity: 1.25, unitCost: 10 }]), false);
  assert.equal(hasValidSupplierOrderItems([{ quantity: 2, unitCost: 0 }]), false);
});
