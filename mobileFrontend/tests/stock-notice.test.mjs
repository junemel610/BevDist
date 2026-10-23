import test from 'node:test';
import assert from 'node:assert/strict';
import { stockNotice } from '../src/components/inventory/stockNotice.js';

test('stock feedback shows current available cases, deduplicates lines, and keeps a short preview', () => {
  const products = ['a','b','c'].map(id => ({ id, name: id, stockByCasePack: { A: { totalStock: 5, reservedStock: 1 } } }));
  const items = ['a','a','b','c'].map(productId => ({ productId, packId: 'A' }));
  const text = stockNotice(items, products, 'Invoice saved');
  assert.equal(text, 'Invoice saved\na A: 4 cases left · b A: 4 cases left · +1 more case types');
});
