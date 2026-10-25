const { HttpError } = require('../middleware/errors');
const { createHash } = require('node:crypto');
const { transaction } = require('../db/connection');
const { ensureCustomCaseTypes } = require('./catalogService');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function receiveSupplierOrder(pool, input, actorId) {
  const { supplierId, newSupplier, items = [], newProducts = [], returnedCases = [], newCasePackTypes = [], requestKey } = input;
  const requestHash = hash([supplierId, newSupplier, items, newProducts, returnedCases, newCasePackTypes, actorId]);
  return transaction(pool, async client => {
    // Serialize retries before creating any inline catalog records.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [requestKey]);
    const old = (await client.query('SELECT id,request_hash FROM supplier_orders WHERE request_key=$1', [requestKey])).rows[0];
    if (old) {
      if (old.request_hash !== requestHash) throw new HttpError(409, 'Request key reused with different supplier order');
      return old.id;
    }
    let resolvedSupplierId = supplierId;
    if (newSupplier) {
      const created = await client.query(`INSERT INTO suppliers(name,contact,address) VALUES ($1,$2,$3)
        ON CONFLICT (name) DO NOTHING RETURNING id`, [newSupplier.name.trim(), (newSupplier.contact || '').trim(), (newSupplier.address || '').trim()]);
      if (!created.rowCount) throw new HttpError(409, 'A supplier with this name already exists. Select the saved supplier instead.');
      resolvedSupplierId = created.rows[0].id;
    }
    const supplierLock = await client.query('SELECT id FROM suppliers WHERE id=$1 AND is_active FOR UPDATE', [resolvedSupplierId]);
    if (!supplierLock.rowCount) throw new HttpError(404, 'Supplier not found or archived');
    await ensureCustomCaseTypes(client, newCasePackTypes);
    const receiptItems = [...items];
    for (const product of newProducts) {
      const duplicate = await client.query(`SELECT id FROM products
        WHERE supplier_id=$1 AND is_active AND lower(name)=lower($2) LIMIT 1`, [resolvedSupplierId, product.name.trim()]);
      if (duplicate.rowCount) throw new HttpError(409, `Product "${product.name.trim()}" already exists for this supplier.`);
      const created = await client.query('INSERT INTO products(name,supplier_id) VALUES ($1,$2) RETURNING id', [product.name.trim(), resolvedSupplierId]);
      const productId = created.rows[0].id;
      for (const pack of product.packs) {
        const packResult = await client.query(`INSERT INTO product_case_packs(product_id,pack_code,case_price)
          SELECT $1,code,$3 FROM case_pack_types WHERE code=$2 AND is_active RETURNING pack_code`, [productId, pack.packId, pack.casePrice]);
        if (!packResult.rowCount) throw new HttpError(400, `Unknown case type: ${pack.packId}`);
        receiptItems.push({ productId, packId: pack.packId, quantity: pack.quantity, unitCost: pack.unitCost });
      }
    }
    const order = (await client.query(`INSERT INTO supplier_orders(supplier_id,supplier_name_snapshot,request_key,request_hash,created_by)
      SELECT id,name,$2,$3,$4 FROM suppliers WHERE id=$1 AND is_active RETURNING id`, [resolvedSupplierId, requestKey, requestHash, actorId])).rows[0];
    if (!order) throw new HttpError(404, 'Supplier is missing or archived');
    for (const item of receiptItems.sort((a, b) => `${a.productId}/${a.packId}`.localeCompare(`${b.productId}/${b.packId}`))) {
      // Hold catalog rows until the write commits so archiving cannot race stock changes.
      await client.query('SELECT id FROM products WHERE id=$1 FOR SHARE', [item.productId]);
      await client.query('SELECT pack_code FROM product_case_packs WHERE product_id=$1 AND pack_code=$2 FOR UPDATE', [item.productId, item.packId]);
      const result = await client.query(`INSERT INTO supplier_order_items
        (supplier_order_id,product_id,pack_code,product_name_snapshot,pack_label_snapshot,units_per_case_snapshot,quantity_cases,cost_per_case_snapshot)
        SELECT $1,p.id,pc.pack_code,p.name,ct.label,ct.units_per_case,$4,$5 FROM products p
        JOIN product_case_packs pc ON pc.product_id=p.id JOIN case_pack_types ct ON ct.code=pc.pack_code
        WHERE p.id=$2 AND pc.pack_code=$3 AND p.supplier_id=$6 AND p.is_active AND pc.is_active AND ct.is_active`,
      [order.id, item.productId, item.packId, item.quantity, item.unitCost, resolvedSupplierId]);
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
