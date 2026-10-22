import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCases, caseAvailabilityLabel, CASE_PACKS, invoiceCaseItem, isValidCaseQuantity } from '../src/components/orders/casePacks.js';

test('case quantities support half-case steps only', () => {
  assert.equal(isValidCaseQuantity(0.5), true);
  assert.equal(isValidCaseQuantity(1), true);
  assert.equal(isValidCaseQuantity(0.25), false);
  assert.equal(isValidCaseQuantity(0), false);
});

test('invoice case line converts to base stock units and case price', () => {
  const item = invoiceCaseItem({ id: 'p1', name: 'Drink', unitPrice: 20 }, CASE_PACKS[0], 0.5);
  assert.equal(item.quantity, 0.5);
  assert.equal(item.stockQuantity, 6);
  assert.equal(item.unitPrice, 240);
  assert.equal(item.bottleUnitPrice, 20);
});

test('available cases use half-case increments and respect pack size', () => {
  assert.equal(availableCases(15, CASE_PACKS[0]), 1);
  assert.equal(availableCases(11, CASE_PACKS[0]), 0.5);
  assert.equal(availableCases(11, CASE_PACKS[1]), 0);
});

test('case-left summary shows general packs or Mucho Red Horse pack sizes', () => {
  assert.equal(caseAvailabilityLabel('Cola', 24), 'A: 2 cases · B: 1 cases · C: 4 cases');
  assert.equal(caseAvailabilityLabel('Mucho Red Horse', 12), 'MUCHO_6: 2 cases · MUCHO_12: 1 cases');
});
