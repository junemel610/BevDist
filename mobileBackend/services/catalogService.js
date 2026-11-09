const { randomUUID } = require('node:crypto');
const { transaction } = require('../db/connection');
const { HttpError } = require('../middleware/errors');

// Table names come only from these two server-owned entry points.
async function saveProfile(pool, table, id, { name, contact = '', address = '' }) {
  const values = [name.trim(), (contact ?? '').trim(), (address ?? '').trim()];
  const result = id
    ? await pool.query(`UPDATE ${table} SET name=$1,contact=$2,address=$3 WHERE id=$4 AND is_active RETURNING id,name,contact,address`, [...values, id])
    : await pool.query(`INSERT INTO ${table}(name,contact,address) VALUES ($1,$2,$3) RETURNING id,name,contact,address`, values);
  if (!result.rowCount) throw new HttpError(404, 'Profile not found');
  return result.rows[0];
}

async function saveCustomer(pool, id, input) {
  const name = String(input?.name ?? '').trim();
  let changedName = true;
  if (id) {
    const existing = await pool.query('SELECT name FROM customers WHERE id=$1 AND is_active', [id]);
    if (!existing.rowCount) throw new HttpError(404, 'Profile not found');
    changedName = existing.rows[0].name.trim().toLocaleLowerCase() !== name.toLocaleLowerCase();
  }
  if (changedName) {
    const duplicate = await pool.query(`SELECT id FROM customers
      WHERE is_active AND lower(btrim(name))=lower(btrim($1)) AND ($2::uuid IS NULL OR id<>$2::uuid) LIMIT 1`, [name, id || null]);
    if (duplicate.rowCount) throw new HttpError(409, 'A customer with this name already exists. Select the existing customer instead.');
  }
  return saveProfile(pool, 'customers', id, { ...input, name });
}
const saveSupplier = (pool, id, input) => saveProfile(pool, 'suppliers', id, input);

async function lockProduct(client, id) {
  const result = await client.query('SELECT id FROM products WHERE id=$1 AND is_active FOR UPDATE', [id]);
  if (!result.rowCount) throw new HttpError(404, 'Product not found');
  await client.query('SELECT pack_code FROM product_case_packs WHERE product_id=$1 ORDER BY pack_code FOR UPDATE', [id]);
}

async function saveProduct(pool, id, { name, supplierId, supplierName, packs, stockReason }, actorId) {
  return transaction(pool, async client => {
    if (!Array.isArray(packs) || packs.length !== 1 || packs[0].packId !== 'B') {
      throw new HttpError(400, 'Products use one generic case unit.');
    }
    if (!supplierId) {
      const supplier = await client.query(`INSERT INTO suppliers(name) VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id,is_active`, [supplierName.trim()]);
      if (!supplier.rows[0].is_active) throw new HttpError(409, 'Supplier is archived');
      supplierId = supplier.rows[0].id;
    }
    const supplier = await client.query('SELECT id FROM suppliers WHERE id=$1 AND is_active FOR SHARE', [supplierId]);
    if (!supplier.rowCount) throw new HttpError(404, 'Supplier not found');
    const creating = !id;
    if (id) {
      await lockProduct(client, id);
      const removed = await client.query(`SELECT pack_code FROM inventory_stock WHERE product_id=$1
        AND is_active AND NOT (pack_code=ANY($2::text[])) AND (total_stock_cases<>0 OR reserved_stock_cases<>0)`, [id, packs.map(p => p.packId)]);
      if (removed.rowCount) throw new HttpError(409, 'Case types with stock or reservations cannot be removed');
      await client.query('UPDATE products SET name=$2,supplier_id=$3 WHERE id=$1', [id, name.trim(), supplierId]);
      await client.query('UPDATE product_case_packs SET is_active=false WHERE product_id=$1', [id]);
    } else {
      id = (await client.query('INSERT INTO products(name,supplier_id) VALUES ($1,$2) RETURNING id', [name.trim(), supplierId])).rows[0].id;
    }
    for (const pack of [...packs].sort((a, b) => a.packId.localeCompare(b.packId))) {
      const result = await client.query(`INSERT INTO product_case_packs(product_id,pack_code,case_price,supplier_cost_per_case,low_stock_threshold_cases)
        SELECT $1,code,$3,$4,$5 FROM case_pack_types WHERE code=$2 AND is_active
        ON CONFLICT (product_id,pack_code) DO UPDATE SET case_price=EXCLUDED.case_price,
        supplier_cost_per_case=EXCLUDED.supplier_cost_per_case,
        low_stock_threshold_cases=EXCLUDED.low_stock_threshold_cases,is_active=true`,
      [id, pack.packId, pack.casePrice, pack.supplierCostPerCase ?? null, pack.lowStockThreshold ?? 15]);
      if (!result.rowCount) throw new HttpError(400, 'Unknown case type');
    }
    for (const pack of packs) {
      if (pack.totalStock == null) continue;
      const stock = (await client.query('SELECT total_stock_cases FROM inventory_stock WHERE product_id=$1 AND pack_code=$2', [id, pack.packId])).rows[0];
      if (!creating && Number(stock.total_stock_cases) !== Number(pack.expectedStock)) {
        throw new HttpError(409, 'Stock changed since this editor opened. Refresh and reopen the product.');
      }
      const delta = Number(pack.totalStock) - Number(stock.total_stock_cases);
      if (delta) await client.query(`INSERT INTO inventory_movements(product_id,pack_code,kind,quantity_delta,request_key,reason,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, pack.packId, creating ? 'OPENING' : 'ADJUSTMENT', delta, randomUUID(), stockReason.trim(), actorId]);
    }
    return { id };
  });
}

async function archiveProduct(pool, id) {
  return transaction(pool, async client => {
    await lockProduct(client, id);
    const stock = await client.query('SELECT 1 FROM inventory_stock WHERE product_id=$1 AND is_active AND (total_stock_cases<>0 OR reserved_stock_cases<>0)', [id]);
    if (stock.rowCount) throw new HttpError(409, 'Clear physical stock and reservations before deleting this product');
    await client.query('UPDATE products SET is_active=false WHERE id=$1', [id]);
    await client.query('UPDATE product_case_packs SET is_active=false WHERE product_id=$1', [id]);
  });
}

async function adjustStock(pool, productId, input, actorId) {
  const { packId, quantityDelta, reason, requestKey } = input;
  return transaction(pool, async client => {
    await lockProduct(client, productId);
    const old = (await client.query('SELECT * FROM inventory_movements WHERE request_key=$1', [requestKey])).rows[0];
    if (old) {
      if (old.kind !== 'ADJUSTMENT' || old.product_id !== productId || old.pack_code !== packId
        || Number(old.quantity_delta) !== Number(quantityDelta) || old.reason !== reason.trim() || old.created_by !== actorId) {
        throw new HttpError(409, 'Request key reused with a different stock adjustment');
      }
      return { id: old.id };
    }
    if (packId !== 'B') throw new HttpError(400, 'Stock uses the generic case unit.');
    const pack = await client.query('SELECT 1 FROM product_case_packs WHERE product_id=$1 AND pack_code=$2 AND is_active', [productId, packId]);
    if (!pack.rowCount) throw new HttpError(404, 'Product case type not found');
    const result = await client.query(`INSERT INTO inventory_movements(product_id,pack_code,kind,quantity_delta,request_key,reason,created_by)
      VALUES ($1,$2,'ADJUSTMENT',$3,$4,$5,$6) RETURNING id`, [productId, packId, quantityDelta, requestKey, reason.trim(), actorId]);
    return result.rows[0];
  });
}

module.exports = { saveCustomer, saveSupplier, saveProduct, archiveProduct, adjustStock };
