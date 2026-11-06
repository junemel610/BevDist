-- Standardize live inventory and pending invoices on 24-bottle cases.
-- Keep immutable invoice and supplier-order snapshots in their original units.
-- The 1/8 storage step preserves bottle counts when old half-cases of 6/12
-- bottle packs are converted; API quantity entry remains restricted to 1/2.
ALTER DOMAIN case_quantity DROP CONSTRAINT case_quantity_check;
ALTER DOMAIN case_quantity ADD CONSTRAINT case_quantity_check
  CHECK (VALUE >= 0 AND VALUE <= 99999999.5 AND mod(VALUE, 0.125) = 0);

ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_quantity_delta_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_quantity_delta_check
  CHECK (quantity_delta <> 0 AND abs(quantity_delta) <= 99999999.5 AND mod(quantity_delta, 0.125) = 0);

-- Ensure each product that had active stock has a B catalog entry. Preserve its
-- 24-case price when present; otherwise convert the prior price per bottle.
INSERT INTO product_case_packs(product_id, pack_code, case_price, low_stock_threshold_cases)
SELECT DISTINCT ON (pc.product_id) pc.product_id, 'B',
  round(pc.case_price * 24 / ct.units_per_case, 2),
  round(pc.low_stock_threshold_cases * ct.units_per_case / 24, 3)
FROM product_case_packs pc
JOIN case_pack_types ct ON ct.code = pc.pack_code
WHERE pc.pack_code <> 'B'
ORDER BY pc.product_id, (pc.pack_code = 'B') DESC, ct.units_per_case DESC, pc.pack_code
ON CONFLICT (product_id, pack_code) DO NOTHING;

-- Transfer the live physical balance without rewriting immutable movement
-- history. Old movements remain as an auditable ledger under retired packs.
WITH converted AS (
  SELECT stock.product_id, sum(stock.total_stock_cases * ct.units_per_case / 24) AS quantity
  FROM inventory_stock stock
  JOIN case_pack_types ct ON ct.code = stock.pack_code
  WHERE stock.pack_code <> 'B'
  GROUP BY stock.product_id
)
INSERT INTO inventory_movements(product_id, pack_code, kind, quantity_delta, request_key, reason, created_by)
SELECT converted.product_id, 'B', 'ADJUSTMENT', converted.quantity, gen_random_uuid(),
  'One-time conversion to 24-bottle case units', (SELECT id FROM app_users ORDER BY created_at, id LIMIT 1)
FROM converted
WHERE converted.quantity > 0;

-- Replace only editable pending invoice lines with equivalent B lines. Every
-- line total is unchanged because the case price scales by the same ratio.
CREATE TEMP TABLE legacy_pending_lines ON COMMIT DROP AS
SELECT ii.id, ii.invoice_id, ii.product_id, ii.product_name_snapshot,
  ii.quantity_cases * ct.units_per_case / 24 AS quantity_cases,
  ii.case_price_snapshot * 24 / ct.units_per_case AS case_price
FROM invoice_items ii
JOIN invoices inv ON inv.id = ii.invoice_id
JOIN case_pack_types ct ON ct.code = ii.pack_code
WHERE ii.is_active AND ii.pack_code <> 'B'
  AND inv.delivered_at IS NULL AND inv.cancelled_at IS NULL;

UPDATE invoice_items ii SET is_active = false
FROM legacy_pending_lines legacy WHERE ii.id = legacy.id;

INSERT INTO invoice_items(invoice_id, product_id, pack_code, product_name_snapshot,
  pack_label_snapshot, units_per_case_snapshot, quantity_cases, case_price_snapshot)
SELECT legacy.invoice_id, legacy.product_id, 'B', legacy.product_name_snapshot,
  'B', 24, legacy.quantity_cases, legacy.case_price
FROM legacy_pending_lines legacy;

-- Multiple legacy pack lines can map to B for a single pending invoice/product;
-- retain those priced snapshots independently. New app writes still use one B line.
DROP INDEX invoice_items_active_pack;

UPDATE product_case_packs SET is_active = false WHERE pack_code <> 'B';
UPDATE product_case_packs SET is_active = true WHERE pack_code = 'B'
  AND EXISTS (SELECT 1 FROM products WHERE products.id = product_case_packs.product_id AND products.is_active);
UPDATE case_pack_types SET is_active = (code = 'B');
