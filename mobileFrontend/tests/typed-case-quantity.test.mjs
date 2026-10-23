import test from 'node:test';
import assert from 'node:assert/strict';
import { caseQuantityInputError } from '../src/components/orders/casePacks.js';

test('typed quantities accept half cases and blank removal while rejecting invalid or unavailable cases', () => {
  for (const value of ['', '0', '.5', '1.5', '2.']) assert.equal(caseQuantityInputError(value, 2), '');
  for (const value of ['0.3', '-1', 'abc', 'Infinity']) assert.ok(caseQuantityInputError(value, 2));
  assert.match(caseQuantityInputError('2.5', 2), /Only 2 cases/);
});
