const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPool, transaction } = require('../db/connection');
const { migrate } = require('../db/migrate');
const { createInvoice, editInvoice, transitionInvoice } = require('../services/invoiceService');
const { recordPayment } = require('../services/paymentService');
const { receiveSupplierOrder } = require('../services/supplierOrderService');
const { loadAppData } = require('../models/app-data');
const { createApp } = require('../app');
const bcrypt = require('bcryptjs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

let admin, pool, actor;
const database = `bevdist_test_${process.pid}_${Date.now()}`;
const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0];
const dueDate = '2099-12-31';

before(async () => {
  admin = createPool();
  // The generated name is never read from user input. Only this disposable DB is dropped.
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  pool = createPool(url.href);
  assert.equal((await migrate(pool)).length, 3);
  actor = (await one("INSERT INTO app_users(username,password_hash) VALUES ('test-user','test-only-hash') RETURNING id")).id;
});

after(async () => {
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});

async function fixture(stock = 10) {
  const customer = (await one("INSERT INTO customers(name,contact,address) VALUES ('Test customer','09123456789','Test address') RETURNING id")).id;
  const supplier = (await one('INSERT INTO suppliers(name) VALUES ($1) RETURNING id', [`Supplier ${randomUUID()}`])).id;
  const product = (await one("INSERT INTO products(name,supplier_id) VALUES ('Test beverage',$1) RETURNING id", [supplier])).id;
  for (const [pack, price] of [['A', 100], ['B', 200], ['C', 50]]) {
    await pool.query('INSERT INTO product_case_packs(product_id,pack_code,case_price) VALUES ($1,$2,$3)', [product, pack, price]);
    if (stock) await pool.query(`INSERT INTO inventory_movements(product_id,pack_code,kind,quantity_delta,request_key,reason,created_by)
      VALUES ($1,$2,'OPENING',$3,$4,'Test opening',$5)`, [product, pack, stock, randomUUID(), actor]);
  }
  return { customer, supplier, product };
}

const invoice = (f, quantity = 1, extra = {}) => createInvoice(pool, {
  customerId: f.customer, items: [{ productId: f.product, packId: 'A', quantity }], dueDate, requestKey: randomUUID(), ...extra,
}, actor);
const pay = (f, amountReceived, extra = {}) => recordPayment(pool, {
  customerId: f.customer, method: 'Cash', amountReceived, requestKey: randomUUID(), ...extra,
}, actor);

test('migrations are repeatable and only catalogs are seeded', async () => {
  assert.deepEqual(await migrate(pool), []);
  assert.equal((await one('SELECT count(*) AS count FROM case_pack_types')).count, '5');
  assert.equal((await one('SELECT count(*) AS count FROM returned_case_types')).count, '0');
});

test('delivery, partial payment, refunds, credit, and frontend DTO reconcile', async () => {
  const f = await fixture();
  const requestKey = randomUUID();
  const input = { requestKey, containerReturns: [{ type: 'Returnable crate', quantity: 1, refundPerCase: 20 }] };
  const id = await invoice(f, 1.5, input);
  assert.equal(await invoice(f, 1.5, input), id);
  await assert.rejects(invoice(f, 2, input), /different invoice/);
  let stock = await one("SELECT * FROM inventory_stock WHERE product_id=$1 AND pack_code='A'", [f.product]);
  assert.equal(stock.total_stock_cases, '10');
  assert.equal(stock.reserved_stock_cases, '1.5');
  assert.equal(stock.available_stock_cases, '8.5');
  assert.equal((await one('SELECT total_amount FROM invoice_summary WHERE id=$1', [id])).total_amount, '130.00');
  await pay(f, 50);
  await transitionInvoice(pool, id, 'deliver');
  await transitionInvoice(pool, id, 'deliver');
  assert.equal((await one('SELECT status FROM invoice_summary WHERE id=$1', [id])).status, 'PENDING');
  stock = await one("SELECT * FROM inventory_stock WHERE product_id=$1 AND pack_code='A'", [f.product]);
  assert.equal(stock.total_stock_cases, '8.5');
  assert.equal(stock.reserved_stock_cases, '0');
  const paymentKey = randomUUID();
  const receipt = await pay(f, 100, { requestKey: paymentKey });
  assert.equal(await pay(f, 100, { requestKey: paymentKey }), receipt);
  await assert.rejects(pay(f, 101, { requestKey: paymentKey }), /different payment/);
  assert.equal((await one('SELECT status FROM invoice_summary WHERE id=$1', [id])).status, 'COMPLETED');
  const next = await invoice(f);
  const nextBalance = await one('SELECT * FROM invoice_balances WHERE invoice_id=$1', [next]);
  assert.equal(Number(nextBalance.credit_applied), 20);
  assert.equal(Number(nextBalance.remaining_balance), 80);
  const snapshot = await loadAppData(pool);
  const dto = snapshot.orders.find(order => order.id === id);
  assert.equal(dto.status, 'completed');
  assert.equal(dto.deliveryStatus, 'delivered');
  assert.equal(dto.subtotal, 150);
  assert.equal(dto.containerRefundTotal, 20);
  assert.equal(dto.grandTotal, 130);
  assert.equal(dto.items[0].stockQuantity, 1.5);
  assert.equal(dto.deposit, undefined);
  assert.equal(dto.customer.id, f.customer);
  assert.equal(snapshot.products.find(p => p.id === f.product).stockByCasePack.A.totalStock, 8.5);
  assert.equal(snapshot.payments.filter(p => p.customerId === f.customer).reduce((s,p) => s+p.amountReceived, 0), 150);
  assert.equal(snapshot.paymentTransactions.filter(p => p.customerId === f.customer).reduce((s,p) => s+p.amountApplied, 0), 130);
  assert.equal(snapshot.balances.find(b => b.orderId === next).appliedCredit, 20);
  assert.equal((await one('SELECT count(*) AS count FROM inventory_movements WHERE invoice_item_id=$1', [dto.items[0].id])).count, '1');
  const { salesSummary } = await import(pathToFileURL(path.resolve(__dirname, '../../mobileFrontend/src/components/dashboard/salesSummary.js')));
  const summary = salesSummary(snapshot.orders, snapshot.balances, snapshot.paymentTransactions);
  const sql = await one("SELECT sum(total_amount) AS expected,sum(remaining_balance) AS outstanding FROM invoice_summary WHERE status<>'CANCELLED'");
  assert.equal(summary.expected, Number(sql.expected));
  assert.equal(summary.outstanding, Number(sql.outstanding));
  assert.equal(summary.actual, 130);
});

test('receipts allocate oldest first and keep Cash and GCash distinct', async () => {
  const f = await fixture();
  const first = await invoice(f);
  const second = await invoice(f);
  const p = await pay(f, 150, { method: 'GCash' });
  const rows = (await pool.query('SELECT * FROM payment_allocations WHERE payment_id=$1 ORDER BY allocation_order', [p])).rows;
  assert.deepEqual(rows.map(r => [r.invoice_id, Number(r.amount_applied)]), [[first, 100], [second, 50]]);
  assert.equal((await one('SELECT method FROM payments WHERE id=$1', [p])).method, 'GCASH');
  const dto = await loadAppData(pool);
  assert.equal(dto.paymentTransactions.filter(r => r.receiptId === p).reduce((s,r) => s+r.amountReceived,0), 150);
  assert.equal(dto.paymentTransactions.find(r => r.receiptId === p).method, 'GCash');
});

test('pending edits preserve history, snapshots and paid amounts', async () => {
  const f = await fixture();
  const id = await invoice(f, 2);
  await pay(f, 150);
  await assert.rejects(editInvoice(pool, id, { items: [{ productId: f.product, packId: 'A', quantity: 1 }] }), /settlements exceed/);
  assert.equal(Number((await one('SELECT total_amount FROM invoice_summary WHERE id=$1', [id])).total_amount), 200);
  await editInvoice(pool, id, { items: [{ productId: f.product, packId: 'B', quantity: 1.5 }] });
  assert.equal(Number((await one("SELECT reserved_stock_cases FROM inventory_stock WHERE product_id=$1 AND pack_code='A'", [f.product])).reserved_stock_cases), 0);
  assert.equal(Number((await one("SELECT reserved_stock_cases FROM inventory_stock WHERE product_id=$1 AND pack_code='B'", [f.product])).reserved_stock_cases), 1.5);
  await pool.query("UPDATE products SET name='Renamed' WHERE id=$1", [f.product]);
  assert.equal((await one('SELECT product_name_snapshot FROM invoice_items WHERE invoice_id=$1 AND is_active', [id])).product_name_snapshot, 'Test beverage');
  await transitionInvoice(pool, id, 'deliver');
  await assert.rejects(editInvoice(pool, id, { items: [{ productId: f.product, packId: 'A', quantity: 2 }] }), /Only undelivered/);
  await assert.rejects(pool.query('DELETE FROM invoices WHERE id=$1', [id]), /instead of deleting/);
});

test('item-only edits preserve return deductions and original case prices', async () => {
  const f = await fixture();
  const id = await invoice(f, 1, { containerReturns: [{ type: 'Crate', quantity: 1, refundPerCase: 20 }] });
  await pool.query("UPDATE product_case_packs SET case_price=120 WHERE product_id=$1 AND pack_code='A'", [f.product]);
  await editInvoice(pool, id, { items: [{ productId: f.product, packId: 'A', quantity: 2 }] });
  const row = await one('SELECT * FROM invoice_summary WHERE id=$1', [id]);
  assert.equal(Number(row.subtotal), 200);
  assert.equal(Number(row.container_refund_total), 20);
  assert.equal(Number(row.total_amount), 180);
});

test('cancellation releases stock, preserves history, and rejects settled invoices', async () => {
  const f = await fixture();
  const id = await invoice(f);
  await transitionInvoice(pool, id, 'cancel', 'Customer cancelled');
  await transitionInvoice(pool, id, 'cancel', 'Customer cancelled');
  const cancelled = await one('SELECT * FROM invoice_summary WHERE id=$1', [id]);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(Number(cancelled.total_amount), 100);
  assert.equal(Number(cancelled.remaining_balance), 0);
  assert.equal(Number((await one("SELECT available_stock_cases FROM inventory_stock WHERE product_id=$1 AND pack_code='A'", [f.product])).available_stock_cases), 10);
  const paid = await invoice(f);
  await pay(f, 10);
  await assert.rejects(transitionInvoice(pool, paid, 'cancel', 'Cancel'), /payment or credit/);
});

test('half cases, refund totals and stock limits are enforced by PostgreSQL', async () => {
  const f = await fixture(0.5);
  for (const quantity of [0, -0.5, 0.25, 0.501]) await assert.rejects(invoice(f, quantity));
  await assert.rejects(invoice(f, 1), /Insufficient/);
  await assert.rejects(invoice(f, 0.5, { containerReturns: [{ type: 'Crate', quantity: 1, refundPerCase: 51 }] }), /Invalid invoice total/);
  await assert.rejects(invoice(f, 0.5, { containerReturns: [{ type: 'Crate', quantity: 1, refundPerCase: '1.001' }] }));
  await invoice(f, 0.5);
  await assert.rejects(pool.query(`INSERT INTO inventory_movements(product_id,pack_code,kind,quantity_delta,request_key,reason,created_by)
    VALUES ($1,'A','ADJUSTMENT',-0.5,$2,'Stock count',$3)`, [f.product, randomUUID(), actor]), /Insufficient/);
});

test('concurrent customers cannot reserve the same last half case', async () => {
  const f = await fixture(0.5);
  const customer = (await one("INSERT INTO customers(name) VALUES ('Second customer') RETURNING id")).id;
  const results = await Promise.allSettled([invoice(f, 0.5), invoice({ ...f, customer }, 0.5)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(Number((await one("SELECT available_stock_cases FROM inventory_stock WHERE product_id=$1 AND pack_code='A'", [f.product])).available_stock_cases), 0);
});

test('concurrent receipts cannot double-pay and excess stays traceable', async () => {
  const f = await fixture();
  const id = await invoice(f);
  await Promise.all([pay(f, 80), pay(f, 80)]);
  const b = await one('SELECT * FROM invoice_balances WHERE invoice_id=$1', [id]);
  assert.equal(Number(b.amount_paid), 100);
  assert.equal(Number((await one('SELECT available_credit FROM customer_credit_balances WHERE customer_id=$1', [f.customer])).available_credit), 60);
  await Promise.all([invoice(f), invoice(f)]);
  assert.equal(Number((await one('SELECT available_credit FROM customer_credit_balances WHERE customer_id=$1', [f.customer])).available_credit), 0);
});

test('supplier receipts update exact case types once and preserve return credits', async () => {
  const f = await fixture(0);
  const input = { supplierId: f.supplier, requestKey: randomUUID(), items: [
    { productId: f.product, packId: 'A', quantity: 2, unitCost: 60 },
    { productId: f.product, packId: 'B', quantity: 0.5, unitCost: 120 },
  ], returnedCases: [{ type: 'Supplier crate', quantity: 1, creditPerUnit: 20 }] };
  const id = await receiveSupplierOrder(pool, input, actor);
  assert.equal(await receiveSupplierOrder(pool, input, actor), id);
  const row = await one('SELECT * FROM supplier_order_totals WHERE id=$1', [id]);
  assert.equal(Number(row.product_cost), 180);
  assert.equal(Number(row.net_cost), 160);
  const stock = (await pool.query('SELECT * FROM inventory_stock WHERE product_id=$1 ORDER BY pack_code', [f.product])).rows;
  assert.deepEqual(stock.map(r => Number(r.total_stock_cases)), [2, 0.5, 0]);
  await assert.rejects(pool.query('DELETE FROM supplier_order_returns WHERE supplier_order_id=$1', [id]), /immutable/);
  await assert.rejects(receiveSupplierOrder(pool, { ...input, requestKey: randomUUID(), returnedCases: [{ type: 'Crate', quantity: 1, creditPerUnit: 181 }] }, actor), /nonnegative/);
});

test('direct SQL cannot cross customers, alter ledgers, or leave receipts unaccounted', async () => {
  const f = await fixture();
  const g = await fixture();
  const id = await invoice(g);
  await assert.rejects(transaction(pool, async c => {
    const payment = (await c.query(`INSERT INTO payments(customer_id,method,received_amount,request_key,created_by)
      VALUES ($1,'CASH',10,$2,$3) RETURNING id`, [f.customer, randomUUID(), actor])).rows[0];
    await c.query('INSERT INTO payment_allocations VALUES ($1,$2,10,1)', [payment.id, id]);
  }), /customer must match/);
  await assert.rejects(pool.query(`INSERT INTO payments(customer_id,method,received_amount,request_key,created_by)
    VALUES ($1,'CASH',10,$2,$3)`, [f.customer, randomUUID(), actor]), /Receipt must equal/);
  const receipt = await pay(f, 10);
  await assert.rejects(pool.query('DELETE FROM payments WHERE id=$1', [receipt]), /Historical/);
  const source = (await one('SELECT id FROM customer_credit_entries WHERE source_payment_id=$1', [receipt])).id;
  await assert.rejects(pool.query(`INSERT INTO customer_credit_entries(customer_id,entry_type,amount,source_credit_entry_id,invoice_id,created_by)
    VALUES ($1,'APPLIED',1,$2,$3,$4)`, [g.customer, source, id, actor]), /belong to customer/);
});

test('Manila reporting dates are independent of server timezone', async () => {
  const f = await fixture();
  await transaction(pool, async c => {
    const p = (await c.query(`INSERT INTO payments(customer_id,method,received_amount,received_at,request_key,created_by)
      VALUES ($1,'CASH',10,'2001-01-01T17:00:00Z',$2,$3) RETURNING id`, [f.customer, randomUUID(), actor])).rows[0];
    await c.query(`INSERT INTO customer_credit_entries(customer_id,entry_type,amount,source_payment_id,created_by)
      VALUES ($1,'ISSUED',10,$2,$3)`, [f.customer, p.id, actor]);
  });
  const day = await one("SELECT received_amount FROM daily_payment_summary WHERE business_date='2001-01-02' AND method='CASH'");
  assert.equal(Number(day.received_amount), 10);
});

test('HTTP routes authenticate, validate, and reach the same database workflows', async () => {
  const f = await fixture();
  const username = `api-${randomUUID()}`;
  const password = 'test-password-with-enough-length';
  const user = await one('INSERT INTO app_users(username,password_hash) VALUES ($1,$2) RETURNING id', [username, await bcrypt.hash(password, 4)]);
  const app = createApp(pool, 'test-only-secret-longer-than-thirty-two-characters');
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let token;
  const request = (url, method = 'GET', body) => fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal((await request('/app-data')).status, 401);
    assert.equal((await request('/auth/login', 'POST', { username, password: 'wrong' })).status, 401);
    const signedIn = await request('/auth/login', 'POST', { username, password });
    assert.equal(signedIn.status, 200);
    token = (await signedIn.json()).token;
    assert.equal((await request('/app-data')).status, 200);
    assert.equal((await request('/invoices', 'POST', { customerId: f.customer, requestKey: randomUUID(), dueDate, items: [{ productId: f.product, packId: 'A', quantity: 0.1 }] })).status, 400);
    const created = await request('/invoices', 'POST', { customerId: f.customer, requestKey: randomUUID(), dueDate,
      items: [{ productId: f.product, packId: 'A', quantity: 1, casePrice: 1 }], total: 1, createdBy: actor });
    assert.equal(created.status, 201);
    const id = (await created.json()).id;
    const stored = await one('SELECT total_amount,created_by FROM invoice_summary WHERE id=$1', [id]);
    assert.equal(Number(stored.total_amount), 100);
    assert.equal(stored.created_by, user.id);
    assert.equal((await request(`/invoices/${id}/deliver`, 'POST')).status, 200);
    assert.equal((await request(`/customers/${f.customer}/payments`, 'POST', { method: 'Cash', amountReceived: 100, requestKey: randomUUID() })).status, 201);
    assert.equal((await one('SELECT status FROM invoice_summary WHERE id=$1', [id])).status, 'COMPLETED');
    assert.equal((await request('/auth/logout', 'POST')).status, 204);
    assert.equal((await request('/app-data')).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('catalog HTTP writes preserve history and enforce per-case stock rules', async () => {
  const secret = 'test-only-secret-longer-than-thirty-two-characters';
  const server = await new Promise(resolve => { const s = createApp(pool, secret).listen(0, '127.0.0.1', () => resolve(s)); });
  const user = await one('SELECT * FROM app_users WHERE id=$1', [actor]);
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: actor, version: user.session_version }, secret, { algorithm: 'HS256', issuer: 'bevdist-api', audience: 'bevdist-mobile', expiresIn: '1h' });
  const request = (url, method, body) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const customerResponse = await request('/customers', 'POST', { name: ' New store ', contact: '09123', address: 'Street' });
    assert.equal(customerResponse.status, 201);
    const customer = await customerResponse.json();
    assert.equal(customer.name, 'New store');
    assert.equal((await request(`/customers/${customer.id}`, 'PUT', { name: 'Updated store' })).status, 200);
    const supplierResponse = await request('/suppliers', 'POST', { name: `Catalog ${randomUUID()}` });
    assert.equal(supplierResponse.status, 201);
    const supplier = await supplierResponse.json();
    const input = { name: 'Beverage', supplierId: supplier.id, packs: [
      { packId: 'A', casePrice: 100, lowStockThreshold: 1 }, { packId: 'B', casePrice: 200 }, { packId: 'C', casePrice: 50 },
    ] };
    assert.equal((await request('/products', 'POST', { ...input, packs: [input.packs[0], input.packs[0]] })).status, 400);
    const created = await request('/products', 'POST', input);
    assert.equal(created.status, 201);
    const product = (await created.json()).id;
    const stockInput = { packId: 'A', quantityDelta: 2, reason: 'Opening count', requestKey: randomUUID() };
    const adjusted = await request(`/products/${product}/stock-adjustments`, 'POST', stockInput);
    assert.equal(adjusted.status, 201);
    assert.deepEqual(await (await request(`/products/${product}/stock-adjustments`, 'POST', stockInput)).json(), await adjusted.json());
    assert.equal((await request(`/products/${product}/stock-adjustments`, 'POST', { ...stockInput, quantityDelta: 3 })).status, 409);
    assert.equal((await request(`/products/${product}/stock-adjustments`, 'POST', { ...stockInput, requestKey: randomUUID(), quantityDelta: 0.1 })).status, 400);
    const inv = await invoice({ product, customer: customer.id });
    assert.equal((await request(`/products/${product}`, 'DELETE')).status, 409);
    assert.equal((await request(`/products/${product}`, 'PUT', { ...input, packs: [input.packs[1]] })).status, 409);
    assert.equal((await request(`/products/${product}/stock-adjustments`, 'POST', { ...stockInput, requestKey: randomUUID(), quantityDelta: -2 })).status, 400);
    assert.equal((await request(`/products/${product}`, 'PUT', { ...input, name: 'Renamed', packs: input.packs.map(p => ({ ...p, casePrice: 300 })) })).status, 200);
    assert.equal(Number((await one('SELECT total_amount FROM invoice_summary WHERE id=$1', [inv])).total_amount), 100);
    await transitionInvoice(pool, inv, 'cancel', 'Test cancellation');
    assert.equal((await request(`/products/${product}/stock-adjustments`, 'POST', { ...stockInput, requestKey: randomUUID(), quantityDelta: -2 })).status, 201);
    assert.equal((await request(`/products/${product}`, 'DELETE')).status, 204);
    const snapshot = await loadAppData(pool);
    assert.equal(snapshot.products.some(p => p.id === product), false);
    assert.equal(snapshot.orders.find(o => o.id === inv).items[0].productName, 'Beverage');
    assert.equal(snapshot.suppliers.some(s => s.id === supplier.id), true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
