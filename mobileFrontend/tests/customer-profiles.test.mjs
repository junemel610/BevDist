import test from 'node:test';
import assert from 'node:assert/strict';
import { saveCustomerProfile } from '../src/components/customers/customerProfiles.js';

test('customer profiles require a name', () => {
  const result = saveCustomerProfile([], { name: '   ' });
  assert.equal(result.customer, null);
  assert.equal(result.error, 'Customer name is required.');
});

test('customer profiles update case-insensitive duplicates without changing their id', () => {
  const existing = [{ id: 'c1', name: 'Maria Santos', contact: '111', address: 'Old address' }];
  const result = saveCustomerProfile(existing, { name: ' maria santos ', contact: '222' });
  assert.equal(result.customers.length, 1);
  assert.equal(result.customer.id, 'c1');
  assert.equal(result.customer.name, 'maria santos');
  assert.equal(result.customer.address, 'Old address');
  assert.equal(result.customer.contact, '222');
});

test('new customer profiles receive a stable id and normalized fields', () => {
  const result = saveCustomerProfile([], { name: ' Ana Reyes ', contact: ' 123 ', address: ' Pasig ' }, () => 'c-new');
  assert.deepEqual(result.customer, { id: 'c-new', name: 'Ana Reyes', contact: '123', address: 'Pasig' });
});
