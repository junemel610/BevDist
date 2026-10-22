import test from 'node:test';
import assert from 'node:assert/strict';
import { filterInventoryProducts, isValidInventoryUpdate, stockState } from '../src/components/inventory/inventoryUtils.js';

const products = [
  { id: 'a', name: 'Cola 1.5L', supplier: 'Coca-Cola', totalStock: 30, reservedStock: 10 },
  { id: 'b', name: 'Orange soda', supplier: 'Pepsi', totalStock: 18, reservedStock: 5 },
  { id: 'c', name: 'Water', supplier: 'Others', totalStock: 4, reservedStock: 4 },
];

test('inventory stock status uses available stock and the 15-unit threshold', () => {
  assert.equal(stockState(16), 'healthy');
  assert.equal(stockState(15), 'low');
  assert.equal(stockState(1), 'low');
  assert.equal(stockState(0), 'out');
  assert.equal(stockState(-1), 'out');
});

test('inventory filters combine product or supplier search, status, and supplier', () => {
  assert.deepEqual(filterInventoryProducts(products, { search: 'PEPSI' }).map(item => item.id), ['b']);
  assert.deepEqual(filterInventoryProducts(products, { status: 'low' }).map(item => item.id), ['b']);
  assert.deepEqual(filterInventoryProducts(products, { supplier: 'Others', status: 'out' }).map(item => item.id), ['c']);
  assert.deepEqual(filterInventoryProducts(products, { search: 'missing' }), []);
});

test('inventory edits cannot lower stock below reservations or accept invalid prices', () => {
  assert.equal(isValidInventoryUpdate(products[0], 10, 20), true);
  assert.equal(isValidInventoryUpdate(products[0], 9, 20), false);
  assert.equal(isValidInventoryUpdate(products[0], 10.5, 20), false);
  assert.equal(isValidInventoryUpdate(products[0], 30, 0), false);
  assert.equal(isValidInventoryUpdate(products[0], 30, Number.NaN), false);
});
