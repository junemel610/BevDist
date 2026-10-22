import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCases, caseAvailabilityLabel, CASE_PACKS, invoiceCaseItem, isValidCaseQuantity } from '../src/components/orders/casePacks.js';

test('case quantities support half-case steps only', () => {
  assert.equal(isValidCaseQuantity(0.5), true);
  assert.equal(isValidCaseQuantity(1), true);
  assert.equal(isValidCaseQuantity(0.25), false);
  assert.equal(isValidCaseQuantity(0), false);
});

test('invoice case line reserves case quantities and calculates the case price', () => {
  const item = invoiceCaseItem({ id: 'p1', name: 'Drink', unitPrice: 20 }, CASE_PACKS[0], 0.5);
  assert.equal(item.quantity, 0.5);
  assert.equal(item.stockQuantity, 0.5);
  assert.equal(item.unitPrice, 240);
  assert.equal(item.baseUnitPrice, 20);
});

test('available case stock uses half-case increments regardless of case pack size', () => {
  assert.equal(availableCases(1, CASE_PACKS[0]), 1);
  assert.equal(availableCases(0.75, CASE_PACKS[0]), 0.5);
  assert.equal(availableCases(0.75, CASE_PACKS[1]), 0.5);
});

test('case-left summary reports case stock without converting it to bottle counts', () => {
  assert.equal(caseAvailabilityLabel(2), '2 cases available');
  assert.equal(caseAvailabilityLabel(0.5), '0.5 cases available');
});
