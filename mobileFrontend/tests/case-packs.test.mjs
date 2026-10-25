import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCases, caseAvailabilityLabel, CASE_PACKS, casePackDisplay, casePacksForProduct, invoiceCaseItem, isValidCaseQuantity } from '../src/components/orders/casePacks.js';

test('case type names stay separate from their bottle-count display', () => {
  assert.equal(CASE_PACKS[0].label, 'A');
  assert.equal(casePackDisplay(CASE_PACKS[0]), 'A · 12 bottles per case');
  assert.equal(casePackDisplay({ id: 'CUSTOM_1', label: 'D · Family pack', unitsPerCase: 18 }), 'D · 18 bottles per case');
  assert.equal(casePackDisplay({ id: 'MUCHO_6', label: '6 bottles/case', unitsPerCase: 6 }), 'Mucho 6 · 6 bottles per case');
});

test('case quantities support half-case steps only', () => {
  assert.equal(isValidCaseQuantity(0.5), true);
  assert.equal(isValidCaseQuantity(1), true);
  assert.equal(isValidCaseQuantity(0.25), false);
  assert.equal(isValidCaseQuantity(0), false);
});

test('invoice case line reserves cases and uses the selected direct case price', () => {
  const item = invoiceCaseItem({ id: 'p1', name: 'Drink', unitPrice: 20 }, CASE_PACKS[0], 0.5);
  assert.equal(item.quantity, 0.5);
  assert.equal(item.stockQuantity, 0.5);
  assert.equal(item.casePrice, 240);
});

test('invoice pricing uses the product price saved for the selected case type', () => {
  const item = invoiceCaseItem({ id: 'p1', name: 'Drink' }, { ...CASE_PACKS[0], casePrice: 315 }, 1.5);
  assert.equal(item.casePrice, 315);
  assert.equal(item.quantity * item.casePrice, 472.5);
});

test('products expose only configured case types and their direct prices', () => {
  assert.deepEqual(casePacksForProduct({
    name: 'Cola', casePackIds: ['A', 'C'], casePrices: { A: 120, C: 60 },
  }).map(pack => [pack.id, pack.casePrice]), [['A', 120], ['C', 60]]);
  assert.deepEqual(casePacksForProduct({
    name: 'Mucho Red Horse', casePackIds: ['MUCHO_6'], casePrices: { MUCHO_6: 450 },
  }).map(pack => [pack.id, pack.casePrice]), [['MUCHO_6', 450]]);
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
