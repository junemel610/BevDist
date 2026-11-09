import test from 'node:test';
import assert from 'node:assert/strict';
import { nextInvoiceNumber } from '../src/components/orders/invoiceNumberPreview.js';

test('invoice number preview advances this Manila month and ignores numbers from other months', () => {
  const records = [
    { invoiceNumber: 'INV-102026-00000009' },
    { invoiceNumber: 'INV-112026-00000003' },
    { invoiceNumber: 'INV-112026-00000002', status: 'cancelled' },
    { invoiceNumber: 'legacy-7' },
  ];
  assert.equal(nextInvoiceNumber(records, new Date('2026-11-09T02:00:00Z')), 'INV-112026-00000004');
  assert.equal(nextInvoiceNumber(records, new Date('2026-12-01T02:00:00Z')), 'INV-122026-00000001');
});
