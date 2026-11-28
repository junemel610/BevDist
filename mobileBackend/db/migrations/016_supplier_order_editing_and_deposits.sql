ALTER TABLE supplier_order_items ADD COLUMN is_current boolean NOT NULL DEFAULT true;
ALTER TABLE supplier_order_returns ADD COLUMN entry_kind text NOT NULL DEFAULT 'return'
  CHECK (entry_kind IN ('deposit', 'return'));
ALTER TABLE supplier_order_returns ADD COLUMN is_current boolean NOT NULL DEFAULT true;

ALTER TABLE supplier_order_items DROP CONSTRAINT supplier_order_items_supplier_order_id_product_id_pack_code_key;
CREATE UNIQUE INDEX supplier_order_items_current_pack
  ON supplier_order_items(supplier_order_id, product_id, pack_code) WHERE is_current;
CREATE INDEX supplier_returns_current_order ON supplier_order_returns(supplier_order_id) WHERE is_current;

CREATE TABLE supplier_order_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL REFERENCES app_users(id)
);
CREATE INDEX supplier_order_edits_order_date ON supplier_order_edits(supplier_order_id, changed_at);
CREATE TRIGGER immutable_supplier_order_edits BEFORE UPDATE OR DELETE ON supplier_order_edits
  FOR EACH ROW EXECUTE FUNCTION reject_history_change();

DROP VIEW supplier_order_totals;
CREATE VIEW supplier_order_totals AS
SELECT o.*,
  coalesce(i.cost, 0) AS product_cost,
  coalesce(r.refund, 0) AS returned_credit,
  coalesce(d.amount, 0) AS deposit_total,
  coalesce(i.cost, 0) + coalesce(d.amount, 0) - coalesce(r.refund, 0) AS net_cost
FROM supplier_orders o
LEFT JOIN (
  SELECT supplier_order_id, sum(line_total) AS cost FROM supplier_order_items WHERE is_current GROUP BY supplier_order_id
) i ON i.supplier_order_id = o.id
LEFT JOIN (
  SELECT supplier_order_id, sum(refund_total) AS refund FROM supplier_order_returns
  WHERE is_current AND entry_kind = 'return' GROUP BY supplier_order_id
) r ON r.supplier_order_id = o.id
LEFT JOIN (
  SELECT supplier_order_id, sum(refund_total) AS amount FROM supplier_order_returns
  WHERE is_current AND entry_kind = 'deposit' GROUP BY supplier_order_id
) d ON d.supplier_order_id = o.id;

CREATE OR REPLACE FUNCTION guard_supplier_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE oid uuid; edit_id text;
BEGIN
  oid := coalesce(NEW.supplier_order_id, OLD.supplier_order_id);
  edit_id := current_setting('app.supplier_order_edit_id', true);
  PERFORM 1 FROM supplier_orders WHERE id = oid AND received_at IS NULL FOR UPDATE;
  IF NOT FOUND AND edit_id IS DISTINCT FROM oid::text THEN
    RAISE EXCEPTION 'Received supplier order lines can only change through the audited edit flow';
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Supplier order lines cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.supplier_order_id <> OLD.supplier_order_id
      OR (to_jsonb(NEW) - 'is_current') IS DISTINCT FROM (to_jsonb(OLD) - 'is_current')
      OR OLD.is_current = false OR NEW.is_current = true) THEN
    RAISE EXCEPTION 'Supplier order history rows are immutable';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION guard_supplier_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE edit_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Supplier history cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' AND NEW.received_at IS NOT NULL THEN RAISE EXCEPTION 'Add lines before receiving a supplier order'; END IF;
  IF TG_OP = 'UPDATE' THEN
    edit_id := current_setting('app.supplier_order_edit_id', true);
    IF OLD.received_at IS NULL THEN
      IF (to_jsonb(NEW) - 'received_at') IS DISTINCT FROM (to_jsonb(OLD) - 'received_at') THEN
        RAISE EXCEPTION 'Only new supplier orders can be received';
      END IF;
    ELSE
      IF edit_id IS DISTINCT FROM OLD.id::text THEN
        RAISE EXCEPTION 'Received supplier orders can only change through the audited edit flow';
      END IF;
      IF NEW.received_at IS DISTINCT FROM OLD.received_at OR
        (to_jsonb(NEW) - ARRAY['supplier_id','supplier_name_snapshot']) IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['supplier_id','supplier_name_snapshot']) THEN
        RAISE EXCEPTION 'Only the supplier can be changed during an audited edit';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION receive_supplier_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item supplier_order_items;
BEGIN
  IF NEW.received_at IS NULL OR OLD.received_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM supplier_order_items WHERE supplier_order_id = NEW.id AND is_current)
     OR (SELECT net_cost FROM supplier_order_totals WHERE id = NEW.id) < 0 THEN
    RAISE EXCEPTION 'Supplier order needs items and nonnegative net cost';
  END IF;
  FOR item IN SELECT * FROM supplier_order_items WHERE supplier_order_id = NEW.id AND is_current ORDER BY product_id, pack_code LOOP
    INSERT INTO inventory_movements(product_id, pack_code, kind, quantity_delta, supplier_order_item_id, request_key, reason, created_by)
    VALUES (item.product_id, item.pack_code, 'SUPPLIER_RECEIPT', item.quantity_cases, item.id, gen_random_uuid(), 'Supplier order received', NEW.created_by);
  END LOOP;
  RETURN NEW;
END; $$;
