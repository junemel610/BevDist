import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRIBUTOR_CATALOG, distributorIdForProduct, findCatalogProduct, otherDistributorFilters } from '../src/components/orders/distributorCatalog.js';

test('distributor selector includes the supplied manufacturers and full product list', () => {
  assert.deepEqual(DISTRIBUTOR_CATALOG.map(item => item.name), ['Coca-Cola', 'Pepsi', 'Asia Brewery', 'ARC Product', 'San Miguel', 'Magnolia Product']);
  assert.equal(DISTRIBUTOR_CATALOG.flatMap(item => item.groups.flatMap(group => group.products)).length, 51);
});

test('saved supplier spelling variants map to the right distributor and catalog product', () => {
  const products = [
    { id: 'cola', name: 'Coke 1.5L', supplier: 'Coca Cola' },
    { id: 'dew', name: 'Mountain Dew Mega', supplier: 'PepsiCo' },
  ];
  assert.equal(distributorIdForProduct(products[0]), 'coca-cola');
  assert.equal(findCatalogProduct('Coke 1.5L', products, 'coca-cola').id, 'cola');
  assert.equal(distributorIdForProduct(products[1]), 'pepsi');
});

test('unlisted products remain available under their saved supplier filter', () => {
  const filters = otherDistributorFilters([{ id: 'x', supplierId: 's1', supplier: 'Local Drinks' }]);
  assert.deepEqual(filters, [{ id: 'supplier:s1', name: 'Local Drinks' }]);
});
