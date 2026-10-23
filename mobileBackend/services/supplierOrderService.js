const { HttpError } = require('../middleware/errors');
const { createHash } = require('node:crypto');
const { transaction } = require('../db/connection');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function receiveSupplierOrder(pool, input, actorId) {
  const { supplierId, items, returnedCases = [], requestKey } = input;
  if (!Array.isArray(items) || !items.length) throw new HttpError(409, 'Supplier order needs items');
  const requestHash = hash([supplierId, items, returnedCases, actorId]);
  return transaction(pool, async client => {
    await client.query('SELECT id FROM suppliers WHERE id=$1 FOR UPDATE', [supplierId]);
    const old = (await client.query('SELECT id,request_hash FROM supplier_orders WHERE request_key=$1', [requestKey])).rows[0];
    if (old) {
      if (old.request_hash !== requestHash) throw new HttpError(409, 'Request key reused with different supplier order');
      return old.id;
    }
    const order = (await client.query(`INSERT INTO supplier_orders(supplier_id,supplier_name_snapshot,request_key,request_hash,created_by)
      SELECT id,name,$2,$3,$4 FROM suppliers WHERE id=$1 AND is_active RETURNING id`, [supplierId, requestKey, requestHash, actorId])).rows[0];
    if (!order) throw new HttpError(404, 'Supplier is missing or archived');
    for (const item of [...items].sort((a, b) => `${a.productId}/${a.packId}`.localeCompare(`${b.productId}/${b.packId}`))) {
      // Hold catalog rows until the write commits so archiving cannot race stock changes.
      await client.query('SELECT id FROM products WHERE id=$1 FOR SHARE', [item.productId]);
      await client.query('SELECT pack_code FROM product_case_packs WHERE product_id=$1 AND pack_code=$2 FOR UPDATE', [item.productId, item.packId]);
      const result = await client.query(`INSERT INTO supplier_order_items
        (supplier_order_id,product_id,pack_code,product_name_snapshot,pack_label_snapshot,units_per_case_snapshot,quantity_cases,cost_per_case_snapshot)
        SELECT $1,p.id,pc.pack_code,p.name,ct.label,ct.units_per_case,$4,$5 FROM products p
        JOIN product_case_packs pc ON pc.product_id=p.id JOIN case_pack_types ct ON ct.code=pc.pack_code
        WHERE p.id=$2 AND pc.pack_code=$3 AND p.supplier_id=$6 AND p.is_active AND pc.is_active AND ct.is_active`,
      [order.id, item.productId, item.packId, item.quantity, item.unitCost, supplierId]);
      if (!result.rowCount) throw new HttpError(404, 'Product case type is missing or archived');
    }
    for (const entry of returnedCases) {
      await client.query(`INSERT INTO supplier_order_returns(supplier_order_id,return_type_id,label_snapshot,quantity_cases,refund_per_case_snapshot)
        VALUES ($1,$2,$3,$4,$5)`, [order.id, entry.returnTypeId || null, entry.type, entry.quantity, entry.creditPerUnit]);
    }
    await client.query('UPDATE supplier_orders SET received_at=now() WHERE id=$1', [order.id]);
    return order.id;
  });
}


module.exports = { receiveSupplierOrder };
