const { HttpError } = require('../middleware/errors');
const { transaction } = require('../db/connection');
const { lockCustomer } = require('./customerLock');
const METHODS = { Cash: 'CASH', GCash: 'GCASH', 'Bank Transfer': 'BANK_TRANSFER' };

async function recordPayment(pool, { customerId, method, amountReceived, requestKey, reference = null }, actorId) {
  const dbMethod = METHODS[method];
  if (!dbMethod) throw new HttpError(409, 'Unknown payment method');
  return transaction(pool, async client => {
    await lockCustomer(client, customerId);
    const old = (await client.query(`SELECT id, customer_id=$2 AND method=$3 AND received_amount=$4::numeric
      AND reference IS NOT DISTINCT FROM $5::text AND created_by=$6 AS matches FROM payments WHERE request_key=$1`,
    [requestKey, customerId, dbMethod, amountReceived, reference, actorId])).rows[0];
    if (old) {
      if (!old.matches) throw new HttpError(409, 'Request key reused with different payment');
      return old.id;
    }
    const payment = (await client.query(`INSERT INTO payments(customer_id,method,received_amount,request_key,reference,created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [customerId, dbMethod, amountReceived, requestKey, reference, actorId])).rows[0];
    const invoices = await client.query(`SELECT i.id FROM invoices i JOIN invoice_balances b ON b.invoice_id=i.id
      WHERE i.customer_id=$1 AND i.cancelled_at IS NULL AND b.remaining_balance>0 ORDER BY i.created_at,i.id FOR UPDATE OF i`, [customerId]);
    let order = 0;
    for (const invoice of invoices.rows) {
      await client.query(`INSERT INTO payment_allocations(payment_id,invoice_id,amount_applied,allocation_order)
        SELECT $1,$2,least(b.remaining_balance,p.received_amount-coalesce(a.applied,0)),$3
        FROM payments p CROSS JOIN invoice_balances b LEFT JOIN
          (SELECT payment_id,sum(amount_applied) AS applied FROM payment_allocations GROUP BY payment_id) a ON a.payment_id=p.id
        WHERE p.id=$1 AND b.invoice_id=$2 AND p.received_amount-coalesce(a.applied,0)>0`, [payment.id, invoice.id, ++order]);
    }
    await client.query(`INSERT INTO customer_credit_entries(customer_id,entry_type,amount,source_payment_id,created_by)
      SELECT p.customer_id,'ISSUED',p.received_amount-coalesce(a.applied,0),p.id,$2
      FROM payments p LEFT JOIN (SELECT payment_id,sum(amount_applied) AS applied FROM payment_allocations GROUP BY payment_id) a ON a.payment_id=p.id
      WHERE p.id=$1 AND p.received_amount-coalesce(a.applied,0)>0`, [payment.id, actorId]);
    return payment.id;
  });
}


module.exports = { recordPayment };
