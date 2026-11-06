import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCases, caseAvailabilityLabel, CASE_PACKS, casePackDisplay, casePacksForProduct, invoiceCaseItem, isValidCaseQuantity } from '../src/components/orders/casePacks.js';
import { formatCaseQuantity } from '../src/components/orders/caseQuantity.js';

test('the only sellable unit is a generic case', () => {
  assert.deepEqual(CASE_PACKS.map(pack => [pack.id, pack.unitsPerCase]), [['B', 1]]);
  assert.equal(casePackDisplay(CASE_PACKS[0]), 'Case');
  assert.deepEqual(casePacksForProduct({ casePackIds: ['B'], casePrices: { B: 480 } }).map(pack => [pack.id, pack.casePrice]), [['B', 480]]);
  assert.deepEqual(casePacksForProduct({ casePackIds: ['A', 'C'] }), []);
  const unpriced = { id: 'catalog-1', name: 'Catalog drink', casePackIds: ['B'], casePrices: { B: null } };
  assert.equal(casePacksForProduct(unpriced)[0].casePrice, null);
  assert.equal(invoiceCaseItem(unpriced, casePacksForProduct(unpriced)[0], 0.5), null);
});

test('case quantities accept half-case increments only', () => {
  assert.equal(isValidCaseQuantity(0.5), true);
  assert.equal(isValidCaseQuantity(1), true);
  assert.equal(isValidCaseQuantity(1.5), true);
  assert.equal(isValidCaseQuantity(0.25), false);
  assert.equal(isValidCaseQuantity(0), false);
});

test('case quantities display halves as fractions', () => {
  assert.equal(formatCaseQuantity(0), '0');
  assert.equal(formatCaseQuantity(0.5), '1/2');
  assert.equal(formatCaseQuantity(1), '1');
  assert.equal(formatCaseQuantity(1.5), '1 1/2');
  assert.equal(formatCaseQuantity(2.25), '2.25');
  assert.equal(caseAvailabilityLabel(0.5), '1/2 cases available');
});

test('invoice quantities use the direct price per product case', () => {
  const item = invoiceCaseItem({ id: 'p1', name: 'Drink' }, { ...CASE_PACKS[0], casePrice: 315 }, 0.5);
  assert.equal(item.quantity, 0.5);
  assert.equal(item.stockQuantity, 0.5);
  assert.equal(item.casePrice, 315);
  assert.equal(item.quantity * item.casePrice, 157.5);
});

test('orderable stock rounds down to half cases', () => {
  assert.equal(availableCases(1, CASE_PACKS[0]), 1);
  assert.equal(availableCases(0.75, CASE_PACKS[0]), 0.5);
  assert.equal(availableCases(0.375, CASE_PACKS[0]), 0);
});
