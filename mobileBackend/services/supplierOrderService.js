const { HttpError } = require('../middleware/errors');
const { createHash } = require('node:crypto');
const { transaction } = require('../db/connection');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function receiveSupplierOrder(pool, input, actorId) {
  const { supplierId, newSupplier, items = [], newProducts = [], returnedCases = [], requestKey } = input;
  if ([...items, ...newProducts.flatMap(product => product.packs || [])].some(item => item.packId !== 'B')) {
    throw new HttpError(400, 'Supplier orders use the generic case unit.');
  }
  if ([...items, ...newProducts.flatMap(product => product.packs || [])].some(item => !(Number(item.quantity) > 0) || !Number.isInteger(Number(item.quantity) * 2))) {
    throw new HttpError(400, 'Supplier order quantities must use half-case increments.');
  }
  const requestHash = hash([supplierId, newSupplier, items, newProducts, returnedCases, actorId]);
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
    const receiptItems = [...items];
    for (const product of newProducts) {
      const duplicate = await client.query(`SELECT id FROM products
        WHERE supplier_id=$1 AND is_active AND lower(name)=lower($2) LIMIT 1`, [resolvedSupplierId, product.name.trim()]);
      if (duplicate.rowCount) throw new HttpError(409, `Product "${product.name.trim()}" already exists for this supplier.`);
      const created = await client.query('INSERT INTO products(name,supplier_id) VALUES ($1,$2) RETURNING id', [product.name.trim(), resolvedSupplierId]);
      const productId = created.rows[0].id;
      for (const pack of product.packs) {
        const packResult = await client.query(`INSERT INTO product_case_packs(product_id,pack_code,case_price,supplier_cost_per_case)
          SELECT $1,code,$3,$4 FROM case_pack_types WHERE code=$2 AND is_active RETURNING pack_code`, [productId, pack.packId, pack.casePrice, pack.unitCost]);
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
      await client.query('UPDATE product_case_packs SET supplier_cost_per_case=$3 WHERE product_id=$1 AND pack_code=$2', [item.productId, item.packId, item.unitCost]);
    }
    for (const entry of returnedCases) {
      await client.query(`INSERT INTO supplier_order_returns(supplier_order_id,return_type_id,label_snapshot,quantity_cases,refund_per_case_snapshot,entry_kind)
        VALUES ($1,$2,$3,$4,$5,$6)`, [order.id, entry.returnTypeId || null, entry.type, entry.quantity, entry.creditPerUnit, entry.kind === 'deposit' ? 'deposit' : 'return']);
    }
    await client.query('UPDATE supplier_orders SET received_at=now() WHERE id=$1', [order.id]);
    return order.id;
  });
}

async function editSupplierOrder(pool, id, input, actorId) {
  const { supplierId, items = [], returnedCases = [] } = input;
  if (!items.length || items.some(item => item.packId !== 'B' || !(Number(item.quantity) > 0)
    || !Number.isInteger(Number(item.quantity) * 2) || !(Number(item.unitCost) > 0))) {
    throw new HttpError(400, 'Provide valid supplier order product lines using half-case quantities.');
  }
  if (returnedCases.some(item => !(Number(item.quantity) > 0) || !Number.isInteger(Number(item.quantity) * 2)
    || !String(item.type || '').trim() || !(Number(item.creditPerUnit) > 0)
    || !['deposit', 'return'].includes(item.kind || 'return'))) {
    throw new HttpError(400, 'Provide valid deposit and return lines.');
  }
  const adjustmentTotal = returnedCases.reduce((sum, item) => sum + Number(item.quantity) * Number(item.creditPerUnit) * (item.kind === 'deposit' ? 1 : -1), 0);
  const productTotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
  if (productTotal + adjustmentTotal < 0) throw new HttpError(400, 'Returns cannot exceed product cost plus deposits.');

  return transaction(pool, async client => {
    const order = (await client.query('SELECT * FROM supplier_orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!order || !order.received_at) throw new HttpError(404, 'Received supplier order not found');
    const supplier = (await client.query('SELECT id,name FROM suppliers WHERE id=$1 AND is_active FOR SHARE', [supplierId])).rows[0];
    if (!supplier) throw new HttpError(404, 'Supplier not found or archived');
    const beforeItems = (await client.query(`SELECT product_id,pack_code,product_name_snapshot,pack_label_snapshot,units_per_case_snapshot,quantity_cases,cost_per_case_snapshot
      FROM supplier_order_items WHERE supplier_order_id=$1 AND is_current ORDER BY product_id,pack_code`, [id])).rows;
    const beforeReturns = (await client.query(`SELECT return_type_id,label_snapshot,entry_kind,quantity_cases,refund_per_case_snapshot
      FROM supplier_order_returns WHERE supplier_order_id=$1 AND is_current ORDER BY id`, [id])).rows;
    const before = { supplierId: order.supplier_id, supplier: order.supplier_name_snapshot, items: beforeItems, adjustments: beforeReturns };
    await client.query("SELECT set_config('app.supplier_order_edit_id',$1,true)", [id]);
    await client.query('UPDATE supplier_orders SET supplier_id=$2,supplier_name_snapshot=$3 WHERE id=$1', [id, supplier.id, supplier.name]);
    await client.query('UPDATE supplier_order_items SET is_current=false WHERE supplier_order_id=$1 AND is_current', [id]);
    await client.query('UPDATE supplier_order_returns SET is_current=false WHERE supplier_order_id=$1 AND is_current', [id]);

    const createdItems = [];
    for (const item of items) {
      const product = (await client.query(`SELECT p.id,p.name,p.supplier_id,ct.label,ct.units_per_case
        FROM products p JOIN product_case_packs pc ON pc.product_id=p.id AND pc.pack_code=$2 AND pc.is_active
        JOIN case_pack_types ct ON ct.code=pc.pack_code AND ct.is_active
        WHERE p.id=$1 AND p.is_active FOR SHARE OF p,pc`, [item.productId, item.packId])).rows[0];
      if (!product || product.supplier_id !== supplier.id) throw new HttpError(400, 'Every product must belong to the selected supplier.');
      const inserted = await client.query(`INSERT INTO supplier_order_items
        (supplier_order_id,product_id,pack_code,product_name_snapshot,pack_label_snapshot,units_per_case_snapshot,quantity_cases,cost_per_case_snapshot)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, item.productId, item.packId, product.name, product.label, product.units_per_case, item.quantity, item.unitCost]);
      createdItems.push(inserted.rows[0]);
      await client.query(`INSERT INTO inventory_movements(product_id,pack_code,kind,quantity_delta,supplier_order_item_id,request_key,reason,created_by)
        VALUES ($1,$2,'SUPPLIER_RECEIPT',$3,$4,gen_random_uuid(),$5,$6)`,
      [item.productId, item.packId, item.quantity, inserted.rows[0].id, `Supplier order ${order.order_number} edited receipt`, actorId]);
      await client.query('UPDATE product_case_packs SET supplier_cost_per_case=$3 WHERE product_id=$1 AND pack_code=$2', [item.productId, item.packId, item.unitCost]);
    }

    for (const old of beforeItems) {
      await client.query(`INSERT INTO inventory_movements(product_id,pack_code,kind,quantity_delta,request_key,reason,created_by)
        VALUES ($1,$2,'ADJUSTMENT',$3,gen_random_uuid(),$4,$5)`,
      [old.product_id, old.pack_code, -Number(old.quantity_cases), `Reverse prior receipt for edited supplier order ${order.order_number}`, actorId]);
    }
    for (const entry of returnedCases) {
      await client.query(`INSERT INTO supplier_order_returns(supplier_order_id,return_type_id,label_snapshot,quantity_cases,refund_per_case_snapshot,entry_kind)
        VALUES ($1,$2,$3,$4,$5,$6)`, [id, entry.returnTypeId || null, entry.type.trim(), entry.quantity, entry.creditPerUnit, entry.kind || 'return']);
    }
    const after = {
      supplierId: supplier.id, supplier: supplier.name,
      items: createdItems.map(item => ({ product_id: item.product_id, pack_code: item.pack_code, product_name_snapshot: item.product_name_snapshot, pack_label_snapshot: item.pack_label_snapshot, units_per_case_snapshot: item.units_per_case_snapshot, quantity_cases: item.quantity_cases, cost_per_case_snapshot: item.cost_per_case_snapshot })),
      adjustments: returnedCases,
    };
    await client.query('INSERT INTO supplier_order_edits(supplier_order_id,before_state,after_state,changed_by) VALUES ($1,$2,$3,$4)', [id, before, after, actorId]);
    return id;
  });
}


module.exports = { receiveSupplierOrder, editSupplierOrder };
