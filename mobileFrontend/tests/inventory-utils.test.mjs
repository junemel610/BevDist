import test from 'node:test';
import assert from 'node:assert/strict';
import { availableStock, canDeleteProduct, createProductProfile, filterInventoryProducts, isValidInventoryUpdate, productStockState, stockForCasePack, stockState } from '../src/components/inventory/inventoryUtils.js';

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
  assert.equal(canDeleteProduct({ stockByCasePack: { A: { totalStock: 0.5, reservedStock: 0 } } }), false);
  assert.equal(canDeleteProduct({ stockByCasePack: { A: { totalStock: 0, reservedStock: 0 } } }), true);
});

test('inventory filters combine product or supplier search, status, and supplier', () => {
  assert.deepEqual(filterInventoryProducts(products, { search: 'PEPSI' }).map(item => item.id), ['b']);
  assert.deepEqual(filterInventoryProducts(products, { status: 'low' }).map(item => item.id), ['b']);
  assert.deepEqual(filterInventoryProducts(products, { supplier: 'Others', status: 'out' }).map(item => item.id), ['c']);
  assert.deepEqual(filterInventoryProducts(products, { search: 'missing' }), []);
});

test('stock is kept separate per case type and edits preserve reservations', () => {
  const product = { name: 'Cola', reservedStock: 0, casePackIds: ['A', 'B'], stockByCasePack: { A: { totalStock: 10, reservedStock: 2 }, B: { totalStock: 4, reservedStock: 1 } } };
  assert.equal(availableStock(product, 'A'), 8);
  assert.equal(availableStock(product, 'B'), 3);
  assert.equal(availableStock(product), 11);
  assert.deepEqual(stockForCasePack(product, 'A'), { totalStock: 10, reservedStock: 2 });
  assert.equal(isValidInventoryUpdate(product, { A: { totalStock: 2.5 }, B: { totalStock: 1 } }, ['A', 'B'], { A: 120, B: 250 }), true);
  assert.equal(isValidInventoryUpdate(product, { A: { totalStock: 1.5 }, B: { totalStock: 1 } }, ['A', 'B'], { A: 120, B: 250 }), false);
  assert.equal(isValidInventoryUpdate(product, { A: { totalStock: 10 }, B: { totalStock: 4 } }, ['A'], { A: 120 }), false);
  assert.equal(isValidInventoryUpdate(product, { A: { totalStock: 10 }, B: { totalStock: 0 } }, ['A'], { A: 120 }), false);
  assert.equal(isValidInventoryUpdate({ ...product, casePackIds: ['A', 'B'], stockByCasePack: { A: { totalStock: 10, reservedStock: 2 }, B: { totalStock: 0, reservedStock: 0 } } }, { A: { totalStock: 10 } }, ['A'], { A: 120 }), true);
  assert.equal(isValidInventoryUpdate(product, { A: { totalStock: 10 } }, ['A'], { A: 0 }), false);
  assert.equal(isValidInventoryUpdate(product, {}, [], {}), false);
});

test('inventory status reflects each case type separately', () => {
  const product = { name: 'Cola', supplier: 'Coca-Cola', casePackIds: ['A', 'B'], stockByCasePack: { A: { totalStock: 50, reservedStock: 0 }, B: { totalStock: 2, reservedStock: 0 } } };
  assert.equal(productStockState(product), 'low');
  assert.deepEqual(filterInventoryProducts([product], { status: 'low' }), [product]);
});

test('new products save selected case types with direct case prices', () => {
  const { product, error } = createProductProfile(products, {
    name: 'Mucho Red Horse', supplier: 'Local supplier',
    stockByCasePack: { MUCHO_6: { totalStock: '2.5' }, MUCHO_12: { totalStock: '2' } },
    casePackIds: ['MUCHO_6', 'MUCHO_12'], casePrices: { MUCHO_6: '430', MUCHO_12: '850' },
  }, () => 'mucho');
  assert.equal(error, null);
  assert.deepEqual(product, {
    id: 'mucho', name: 'Mucho Red Horse', supplier: 'Local supplier',
    stockByCasePack: { MUCHO_6: { totalStock: 2.5, reservedStock: 0 }, MUCHO_12: { totalStock: 2, reservedStock: 0 } },
    casePackIds: ['MUCHO_6', 'MUCHO_12'],
    casePrices: { MUCHO_6: 430, MUCHO_12: 850 },
  });
});

test('new inventory products reject duplicate or invalid product details', () => {
  assert.match(createProductProfile(products, {
    name: ' cola 1.5l ', supplier: 'Coca-Cola', stockByCasePack: { A: { totalStock: 20 } },
    casePackIds: ['A'], casePrices: { A: 100 },
  }).error, /already exists/);
  for (const profile of [
    { name: '', supplier: 'Supplier', stockByCasePack: { A: { totalStock: 1 } }, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: '', stockByCasePack: { A: { totalStock: 1 } }, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: 'Supplier', stockByCasePack: { A: { totalStock: -1 } }, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: 'Supplier', stockByCasePack: { A: { totalStock: 1.25 } }, casePackIds: ['A'], casePrices: { A: 5 } },
    { name: 'New', supplier: 'Supplier', stockByCasePack: { A: { totalStock: 1 } }, casePackIds: ['A'], casePrices: { A: 0 } },
    { name: 'New', supplier: 'Supplier', stockByCasePack: {}, casePackIds: [], casePrices: {} },
  ]) assert.ok(createProductProfile(products, profile).error);
});
