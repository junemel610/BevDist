const { HttpError } = require('../middleware/errors');
const { createHash } = require('node:crypto');
const { transaction } = require('../db/connection');
const { lockCustomer } = require('./customerLock');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function addInvoiceLines(client, invoiceId, items, containerReturns, retainedPrices = {}) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(409, 'Invoice needs at least one item');
  // Stable pack order prevents conflicting invoices from locking stock in opposite order.
  for (const item of [...items].sort((a, b) => `${a.productId}/${a.packId}`.localeCompare(`${b.productId}/${b.packId}`))) {
    const result = await client.query(`INSERT INTO invoice_items
      (invoice_id, product_id, pack_code, product_name_snapshot, pack_label_snapshot,
       units_per_case_snapshot, quantity_cases, case_price_snapshot)
      SELECT $1, p.id, pc.pack_code, p.name, ct.label, ct.units_per_case, $4, coalesce($5::numeric,pc.case_price)
      FROM products p JOIN product_case_packs pc ON pc.product_id=p.id JOIN case_pack_types ct ON ct.code=pc.pack_code
      WHERE p.id=$2 AND pc.pack_code=$3 AND p.is_active AND pc.is_active AND ct.is_active`,
    [invoiceId, item.productId, item.packId, item.quantity, retainedPrices[`${item.productId}:${item.packId}`] ?? null]);
    if (!result.rowCount) throw new HttpError(404, 'Product case type is missing or archived');
  }
  for (const entry of containerReturns) {
    await client.query(`INSERT INTO invoice_container_returns
      (invoice_id, return_type_id, label_snapshot, quantity_cases, refund_per_case_snapshot)
      VALUES ($1,$2,$3,$4,$5)`, [invoiceId, entry.returnTypeId || null, entry.type, entry.quantity, entry.refundPerCase]);
  }
}

async function applyCredit(client, invoiceId, customerId, actorId) {
  const sources = await client.query(`SELECT s.id, s.amount-coalesce(sum(a.amount),0) AS available
    FROM customer_credit_entries s LEFT JOIN customer_credit_entries a ON a.source_credit_entry_id=s.id
    WHERE s.customer_id=$1 AND s.entry_type='ISSUED' GROUP BY s.id
    HAVING s.amount-coalesce(sum(a.amount),0)>0 ORDER BY s.created_at,s.id`, [customerId]);
  for (const source of sources.rows) {
    await client.query(`INSERT INTO customer_credit_entries
      (customer_id,entry_type,amount,source_credit_entry_id,invoice_id,created_by)
      SELECT $1,'APPLIED',least($2::numeric,remaining_balance),$3,$4,$5
      FROM invoice_balances WHERE invoice_id=$4 AND remaining_balance>0`,
    [customerId, source.available, source.id, invoiceId, actorId]);
  }
}

async function createInvoice(pool, input, actorId) {
  const { customerId, items, containerReturns = [], dueDate, requestKey } = input;
  const requestHash = hash([customerId, items, containerReturns, dueDate, actorId]);
  return transaction(pool, async client => {
    await lockCustomer(client, customerId);
    const old = (await client.query('SELECT id,request_hash FROM invoices WHERE request_key=$1', [requestKey])).rows[0];
    if (old) {
      if (old.request_hash !== requestHash) throw new HttpError(409, 'Request key reused with different invoice');
      return old.id;
    }
    const result = await client.query(`INSERT INTO invoices
      (customer_id, customer_name_snapshot, customer_contact_snapshot, customer_address_snapshot, due_date, created_by, request_key, request_hash)
      SELECT id,name,contact,address,$2,$3,$4,$5 FROM customers WHERE id=$1 RETURNING id`,
    [customerId, dueDate, actorId, requestKey, requestHash]);
    const id = result.rows[0].id;
    await addInvoiceLines(client, id, items, containerReturns);
    await applyCredit(client, id, customerId, actorId);
    return id;
  });
}

async function editInvoice(pool, invoiceId, { items, containerReturns }) {
  return transaction(pool, async client => {
    const invoice = (await client.query('SELECT customer_id FROM invoices WHERE id=$1', [invoiceId])).rows[0];
    if (!invoice) throw new HttpError(404, 'Invoice not found');
    await lockCustomer(client, invoice.customer_id);
    await client.query('SELECT id FROM invoices WHERE id=$1 FOR UPDATE', [invoiceId]);
    const previous = (await client.query('SELECT product_id,pack_code,case_price_snapshot FROM invoice_items WHERE invoice_id=$1 AND is_active', [invoiceId])).rows;
    const retainedPrices = Object.fromEntries(previous.map(row => [`${row.product_id}:${row.pack_code}`, row.case_price_snapshot]));
    const currentReturns = (await client.query('SELECT * FROM invoice_container_returns WHERE invoice_id=$1 AND is_active', [invoiceId])).rows;
    const returns = containerReturns ?? currentReturns.map(row => ({
      returnTypeId: row.return_type_id, type: row.label_snapshot, quantity: row.quantity_cases, refundPerCase: row.refund_per_case_snapshot,
    }));
    await client.query('UPDATE invoice_items SET is_active=false WHERE invoice_id=$1 AND is_active', [invoiceId]);
    await client.query('UPDATE invoice_container_returns SET is_active=false WHERE invoice_id=$1 AND is_active', [invoiceId]);
    await addInvoiceLines(client, invoiceId, items, returns, retainedPrices);
    return invoiceId;
  });
}

async function transitionInvoice(pool, invoiceId, action, reason = '') {
  if (!['deliver', 'cancel'].includes(action)) throw new HttpError(409, 'Invalid invoice action');
  return transaction(pool, async client => {
    const invoice = (await client.query('SELECT customer_id FROM invoices WHERE id=$1', [invoiceId])).rows[0];
    if (!invoice) throw new HttpError(404, 'Invoice not found');
    await lockCustomer(client, invoice.customer_id);
    const current = (await client.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE', [invoiceId])).rows[0];
    if (action === 'deliver' && current.delivered_at) return invoiceId;
    if (action === 'cancel' && current.cancelled_at) return invoiceId;
    if (action === 'deliver') await client.query('UPDATE invoices SET delivered_at=now() WHERE id=$1', [invoiceId]);
    else await client.query('UPDATE invoices SET cancelled_at=now(),cancellation_reason=$2 WHERE id=$1', [invoiceId, reason]);
    return invoiceId;
  });
}


module.exports = { createInvoice, editInvoice, transitionInvoice };
