import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteProduct, createProductProfile, filterInventoryProducts, isValidInventoryUpdate, stockState } from '../src/components/inventory/inventoryUtils.js';

const products = [
  { id: 'a', name: 'Cola 1.5L', supplier: 'Coca-Cola', totalStock: 30, reservedStock: 10 },
  { id: 'b', name: 'Orange soda', supplier: 'Pepsi', totalStock: 18, reservedStock: 5 },
  { id: 'c', name: 'Water', supplier: 'Others', totalStock: 4, reservedStock: 4 },
];

test('inventory stock status uses available cases and the 15-case threshold', () => {
  assert.equal(stockState(16), 'healthy');
  assert.equal(stockState(15), 'low');
  assert.equal(stockState(1), 'low');
  assert.equal(stockState(0), 'out');
  assert.equal(stockState(-1), 'out');
});

test('products with active stock reservations cannot be deleted', () => {
  assert.equal(canDeleteProduct({ reservedStock: 0 }), true);
  assert.equal(canDeleteProduct({ reservedStock: 0.5 }), false);
});

test('inventory filters combine product or supplier search, status, and supplier', () => {
  assert.deepEqual(filterInventoryProducts(products, { search: 'PEPSI' }).map(item => item.id), ['b']);
  assert.deepEqual(filterInventoryProducts(products, { status: 'low' }).map(item => item.id), ['b']);
  assert.deepEqual(filterInventoryProducts(products, { supplier: 'Others', status: 'out' }).map(item => item.id), ['c']);
  assert.deepEqual(filterInventoryProducts(products, { search: 'missing' }), []);
});

test('inventory edits accept half-cases but cannot undercut reservations or accept invalid prices', () => {
  assert.equal(isValidInventoryUpdate(products[0], 10, ['A'], { A: 120 }), true);
  assert.equal(isValidInventoryUpdate(products[0], 10.5, ['A'], { A: 120 }), true);
  assert.equal(isValidInventoryUpdate(products[0], 9, ['A'], { A: 120 }), false);
  assert.equal(isValidInventoryUpdate(products[0], 10.25, ['A'], { A: 120 }), false);
  assert.equal(isValidInventoryUpdate(products[0], 30, ['A'], { A: 0 }), false);
  assert.equal(isValidInventoryUpdate(products[0], 30, [], {}), false);
});

test('new products save selected case types with direct case prices', () => {
  const { product, error } = createProductProfile(products, {
    name: 'Mucho Red Horse', supplier: 'Local supplier', totalStock: '4.5',
    casePackIds: ['MUCHO_6', 'MUCHO_12'], casePrices: { MUCHO_6: '430', MUCHO_12: '850' },
  }, () => 'mucho');
  assert.equal(error, null);
  assert.deepEqual(product, {
    id: 'mucho', name: 'Mucho Red Horse', supplier: 'Local supplier',
    totalStock: 4.5, reservedStock: 0, casePackIds: ['MUCHO_6', 'MUCHO_12'],
    casePrices: { MUCHO_6: 430, MUCHO_12: 850 },
  });
});

test('new inventory products reject duplicate or invalid product details', () => {
  assert.match(createProductProfile(products, {
    name: ' cola 1.5l ', supplier: 'Coca-Cola', totalStock: 20,
    casePackIds: ['A'], casePrices: { A: 100 },
  }).error, /already exists/);
  for (const profile of [
    { name: '', supplier: 'Supplier', totalStock: 1, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: '', totalStock: 1, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: 'Supplier', totalStock: -1, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: 'Supplier', totalStock: 1.25, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: 'Supplier', totalStock: 1, casePackIds: ['A'], casePrices: { A: 0 } },
    { name: 'New', supplier: 'Supplier', totalStock: 1, casePackIds: [], casePrices: {} },
  ]) assert.ok(createProductProfile(products, profile).error);
});
