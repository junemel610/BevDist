import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSupplierOrderNumber } from '../src/components/supplierOrders/orderNumberPreview.js';

test('supplier order preview increments the current Manila month and resets next month', () => {
  const records = [
    { orderNumber: 'ORD-112026-00000003' },
    { orderNumber: 'ORD-102026-00000099' },
    { orderNumber: 'SUP-00000050' },
  ];
  assert.equal(nextSupplierOrderNumber(records, new Date('2026-11-09T02:00:00Z')), 'ORD-112026-00000004');
  assert.equal(nextSupplierOrderNumber(records, new Date('2026-12-01T02:00:00Z')), 'ORD-122026-00000001');
});
