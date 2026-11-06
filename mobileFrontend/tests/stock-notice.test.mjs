import test from 'node:test';
import assert from 'node:assert/strict';
import { stockNotice } from '../src/components/inventory/stockNotice.js';

test('stock feedback shows current available cases, deduplicates lines, and keeps a short preview', () => {
  const products = ['a','b','c'].map(id => ({ id, name: id, stockByCasePack: { B: { totalStock: 5.5, reservedStock: 1 } } }));
  const items = ['a','a','b','c'].map(productId => ({ productId, packId: 'B' }));
  const text = stockNotice(items, products, 'Invoice saved');
  assert.equal(text, 'Invoice saved\na: 4 1/2 cases left · b: 4 1/2 cases left · +1 more products');
});
