-- The edit flow only changes is_current on old rows. Exclude generated totals
-- because PostgreSQL has not recomputed them yet in a BEFORE UPDATE trigger.
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
  IF TG_OP = 'UPDATE' AND (
      NEW.supplier_order_id IS DISTINCT FROM OLD.supplier_order_id
      OR (to_jsonb(NEW) - ARRAY['is_current','line_total','refund_total'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['is_current','line_total','refund_total'])
      OR OLD.is_current = false OR NEW.is_current = true
  ) THEN
    RAISE EXCEPTION 'Supplier order history rows are immutable';
  END IF;
  RETURN NEW;
END; $$;
