import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveData } from '../src/api/liveData.js';

function setup() {
  const calls = [];
  const endpoint = name => async (...args) => { calls.push([name, ...args]); return { data: { id: name } }; };
  const api = {
    appDataAPI: { get: async () => ({ data: { orders: [], products: [] } }) },
    customersAPI: { create: endpoint('create-customer'), update: endpoint('update-customer') },
    invoicesAPI: { create: endpoint('create-invoice'), update: endpoint('edit-invoice'), deliver: endpoint('deliver'), cancel: endpoint('cancel') },
    paymentsAPI: { create: endpoint('payment') }, supplierOrdersAPI: { create: endpoint('restock') },
    productsAPI: { create: endpoint('create-product'), update: endpoint('edit-product'), remove: endpoint('archive') },
  };
  let key = 0;
  return { api, calls, live: createLiveData(api, () => `key-${++key}`) };
}

test('live writes send cases and database IDs without trusting client invoice prices', async () => {
  const { live, calls } = setup();
  await live.createOrder({ id: 'customer' }, [{ productId: 'product', packId: 'B', quantity: 0.5, casePrice: 1 }]);
  const input = calls[0][1];
  assert.equal(input.customerId, 'customer');
  assert.deepEqual(input.items, [{ productId: 'product', packId: 'B', quantity: 0.5 }]);
  assert.match(input.dueDate, /^\d{4}-\d{2}-\d{2}$/);
  await live.payment({ customerId: 'customer' }, 5500, 'Cash');
  assert.deepEqual(calls[1], ['payment', 'customer', { amountReceived: 5500, method: 'Cash', requestKey: 'key-2' }]);
});

test('ambiguous failures reuse keys; independent successful invoices get new keys', async () => {
  const { api, live } = setup();
  const keys = [];
  api.invoicesAPI.create = async input => { keys.push(input.requestKey); if (keys.length === 1) throw new Error('Network lost'); return { data: { id: 'invoice' } }; };
  const items = [{ productId: 'product', packId: 'B', quantity: 1 }];
  await assert.rejects(live.createOrder({ id: 'customer' }, items));
  await live.createOrder({ id: 'customer' }, items);
  await live.createOrder({ id: 'customer' }, items);
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});

test('inventory sends original counts and updated prices/stock in one request', async () => {
  const { live, calls } = setup();
  await live.saveProduct('product', { casePackIds: ['B'], casePrices: { B: '100' }, stockByCasePack: { B: { totalStock: 2.5 } }, stockReason: 'Count correction' },
    { name: 'Beverage', supplierId: 'supplier', stockByCasePack: { B: { totalStock: 3, lowStockThreshold: 2 } } });
  assert.deepEqual(calls[0][2].packs, [{ packId: 'B', casePrice: 100, lowStockThreshold: 2, totalStock: 2.5, expectedStock: 3 }]);
  await live.transition('invoice', 'cancelled');
  assert.deepEqual(calls[1], ['cancel', 'invoice', 'Cancelled by operator']);
  assert.deepEqual(await live.load(), { orders: [], products: [] });
});

test('supplier receipt sends saved IDs or inline drafts and retains retry keys after an uncertain response', async () => {
  const { api, live, calls } = setup();
  const items = [{ productId: 'product', packId: 'B', quantity: 0.5, unitCost: 40, productName: 'UI-only' }];
  await live.restock({ id: 'supplier', name: 'Saved' }, items, []);
  assert.deepEqual(calls[0][1], { supplierId: 'supplier', items: [{ productId: 'product', packId: 'B', quantity: 0.5, unitCost: 40 }], newProducts: [], returnedCases: [], requestKey: 'key-1' });
  const requests = [];
  api.supplierOrdersAPI.create = async input => { requests.push(input); if (requests.length === 1) throw new Error('Response lost'); return { data: { id: 'receipt' } }; };
  const supplier = { name: 'New', contact: '123', address: 'Depot' };
  const products = [{ name: 'Drink', packs: [{ packId: 'B', casePrice: 100, quantity: 0.5, unitCost: 40 }] }];
  const returns = [{ type: 'A', quantity: 0.5, creditPerUnit: 10 }];
  await assert.rejects(live.restock(supplier, [], returns, products));
  await live.restock(supplier, [], returns, products);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[1].newSupplier, supplier);
  assert.deepEqual(requests[1].newProducts, products);
  assert.deepEqual(requests[1].returnedCases, returns);
  assert.equal(requests[1].supplierId, undefined);
});
