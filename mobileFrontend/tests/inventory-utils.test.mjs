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

test('inventory uses one generic case unit and edits preserve reservations', () => {
  const product = { name: 'Cola', reservedStock: 0, casePackIds: ['B'], stockByCasePack: { B: { totalStock: 4, reservedStock: 1 } } };
  assert.equal(availableStock(product, 'B'), 3);
  assert.equal(availableStock(product), 3);
  assert.deepEqual(stockForCasePack(product, 'B'), { totalStock: 4, reservedStock: 1 });
  assert.equal(isValidInventoryUpdate(product, { B: { totalStock: 2.5 } }, ['B'], { B: 250 }), true);
  assert.equal(isValidInventoryUpdate(product, { B: { totalStock: 0.5 } }, ['B'], { B: 250 }), false);
  assert.equal(isValidInventoryUpdate(product, { B: { totalStock: 4 } }, ['A'], { A: 120 }), false);
  assert.equal(isValidInventoryUpdate(product, { B: { totalStock: 4 } }, ['B'], { B: 0 }), false);
  assert.equal(isValidInventoryUpdate(product, {}, [], {}), false);
});

test('inventory status reflects the standardized case quantity', () => {
  const product = { name: 'Cola', supplier: 'Coca-Cola', casePackIds: ['B'], stockByCasePack: { B: { totalStock: 2, reservedStock: 0 } } };
  assert.equal(productStockState(product), 'low');
  assert.deepEqual(filterInventoryProducts([product], { status: 'low' }), [product]);
});

test('new products save generic case quantities with a direct case price', () => {
  const { product, error } = createProductProfile(products, {
    name: 'New Pack Drink', supplier: 'Local supplier',
    stockByCasePack: { B: { totalStock: '2.5' } }, casePackIds: ['B'], casePrices: { B: '430' },
  }, () => 'custom');
  assert.equal(error, null);
  assert.deepEqual(product, {
    id: 'custom', name: 'New Pack Drink', supplier: 'Local supplier',
    stockByCasePack: { B: { totalStock: 2.5, reservedStock: 0 } }, casePackIds: ['B'], casePrices: { B: 430 },
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
