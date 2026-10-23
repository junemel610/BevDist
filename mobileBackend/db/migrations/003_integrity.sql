-- Writing a revision also makes stale REPEATABLE READ transactions fail safely.
ALTER TABLE product_case_packs ADD COLUMN stock_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN ledger_revision bigint NOT NULL DEFAULT 0;

CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records cannot be edited or deleted' USING ERRCODE = '23514'; END;
$$;

CREATE FUNCTION guard_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cancel invoices instead of deleting history'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.delivered_at IS NOT NULL OR NEW.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Create an invoice pending'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.delivered_at IS NOT NULL OR OLD.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Delivered or cancelled invoices are immutable';
  END IF;
  IF (NEW.id, NEW.customer_id, NEW.invoice_number, NEW.created_at, NEW.created_by) IS DISTINCT FROM
     (OLD.id, OLD.customer_id, OLD.invoice_number, OLD.created_at, OLD.created_by) THEN
    RAISE EXCEPTION 'Invoice identity cannot change';
  END IF;
  IF NEW.cancelled_at IS NOT NULL AND (SELECT amount_paid FROM invoice_balances WHERE invoice_id = OLD.id) > 0 THEN
    RAISE EXCEPTION 'An invoice with payment or credit cannot be cancelled';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_invoice BEFORE INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION guard_invoice();

CREATE FUNCTION guard_invoice_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inv invoices;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Deactivate invoice lines instead of deleting history'; END IF;
  SELECT * INTO inv FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF inv.id IS NULL OR inv.delivered_at IS NOT NULL OR inv.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only undelivered pending invoices can be edited';
  END IF;
  IF TG_OP = 'UPDATE' AND ((to_jsonb(NEW) - ARRAY['is_active','line_total','refund_total']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['is_active','line_total','refund_total'])
     OR NOT OLD.is_active OR NEW.is_active) THEN
    RAISE EXCEPTION 'Replace a line by deactivating it and inserting a new snapshot';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_invoice_items BEFORE INSERT OR UPDATE OR DELETE ON invoice_items FOR EACH ROW EXECUTE FUNCTION guard_invoice_line();
CREATE TRIGGER guard_invoice_returns BEFORE INSERT OR UPDATE OR DELETE ON invoice_container_returns FOR EACH ROW EXECUTE FUNCTION guard_invoice_line();

CREATE FUNCTION guard_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item invoice_items; inv invoices;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Reservation history cannot be deleted'; END IF;
  SELECT * INTO item FROM invoice_items WHERE id = NEW.invoice_item_id;
  SELECT * INTO inv FROM invoices WHERE id = item.invoice_id;
  IF NEW.quantity_cases <> item.quantity_cases THEN RAISE EXCEPTION 'Reservation must match invoice quantity'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'ACTIVE' OR NOT item.is_active OR inv.delivered_at IS NOT NULL OR inv.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only undelivered active items can reserve stock';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['status', 'closed_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'closed_at'])
       OR OLD.status <> 'ACTIVE' OR NEW.status = 'ACTIVE' THEN RAISE EXCEPTION 'Invalid reservation transition'; END IF;
    IF NEW.status = 'FINALIZED' AND inv.delivered_at IS NULL THEN RAISE EXCEPTION 'Stock finalizes on delivery'; END IF;
    IF NEW.status = 'RELEASED' AND item.is_active AND inv.cancelled_at IS NULL THEN RAISE EXCEPTION 'Active invoice still requires reservation'; END IF;
  END IF;
  UPDATE product_case_packs SET stock_revision = stock_revision + 1 WHERE product_id = item.product_id AND pack_code = item.pack_code;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_reservation BEFORE INSERT OR UPDATE OR DELETE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION guard_reservation();

CREATE FUNCTION reserve_invoice_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active THEN
    INSERT INTO inventory_reservations(invoice_item_id, quantity_cases) VALUES (NEW.id, NEW.quantity_cases);
  ELSIF TG_OP = 'UPDATE' AND NOT NEW.is_active THEN
    UPDATE inventory_reservations SET status = 'RELEASED', closed_at = now() WHERE invoice_item_id = NEW.id AND status = 'ACTIVE';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER reserve_invoice_item AFTER INSERT OR UPDATE ON invoice_items FOR EACH ROW EXECUTE FUNCTION reserve_invoice_item();

CREATE FUNCTION guard_movement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item invoice_items; supplier_item supplier_order_items;
BEGIN
  UPDATE product_case_packs SET stock_revision = stock_revision + 1 WHERE product_id = NEW.product_id AND pack_code = NEW.pack_code;
  IF NEW.kind = 'DELIVERY' THEN
    SELECT * INTO item FROM invoice_items WHERE id = NEW.invoice_item_id;
    IF NOT item.is_active OR (NEW.product_id, NEW.pack_code, -NEW.quantity_delta) IS DISTINCT FROM (item.product_id, item.pack_code, item.quantity_cases)
       OR NOT EXISTS (SELECT 1 FROM invoices WHERE id = item.invoice_id AND delivered_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Delivery movement must match a delivered invoice line';
    END IF;
  ELSIF NEW.kind = 'SUPPLIER_RECEIPT' THEN
    SELECT * INTO supplier_item FROM supplier_order_items WHERE id = NEW.supplier_order_item_id;
    IF (NEW.product_id, NEW.pack_code, NEW.quantity_delta) IS DISTINCT FROM (supplier_item.product_id, supplier_item.pack_code, supplier_item.quantity_cases)
       OR NOT EXISTS (SELECT 1 FROM supplier_orders WHERE id = supplier_item.supplier_order_id AND received_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Receipt movement must match a received supplier line';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_movement BEFORE INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION guard_movement();
CREATE TRIGGER immutable_movement BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION reject_history_change();

CREATE FUNCTION check_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid; pack text; stock inventory_stock;
BEGIN
  IF TG_TABLE_NAME = 'inventory_movements' THEN pid := NEW.product_id; pack := NEW.pack_code;
  ELSE SELECT product_id, pack_code INTO pid, pack FROM invoice_items WHERE id = NEW.invoice_item_id; END IF;
  SELECT * INTO stock FROM inventory_stock WHERE product_id = pid AND pack_code = pack;
  IF stock.available_stock_cases < 0 OR stock.total_stock_cases > 99999999.5 THEN
    RAISE EXCEPTION 'Insufficient available stock or stock exceeds limit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER check_movement_stock AFTER INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION check_stock();
CREATE TRIGGER check_reserved_stock AFTER INSERT OR UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION check_stock();

CREATE FUNCTION invoice_stock_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item invoice_items;
BEGIN
  IF NEW.delivered_at IS NULL AND NEW.cancelled_at IS NULL THEN RETURN NEW; END IF;
  FOR item IN SELECT * FROM invoice_items WHERE invoice_id = NEW.id AND is_active ORDER BY product_id, pack_code LOOP
    UPDATE inventory_reservations SET status = CASE WHEN NEW.delivered_at IS NOT NULL THEN 'FINALIZED' ELSE 'RELEASED' END,
      closed_at = now() WHERE invoice_item_id = item.id AND status = 'ACTIVE';
    IF NEW.delivered_at IS NOT NULL THEN
      INSERT INTO inventory_movements(product_id, pack_code, kind, quantity_delta, invoice_item_id, request_key, reason, created_by)
      VALUES (item.product_id, item.pack_code, 'DELIVERY', -item.quantity_cases, item.id, gen_random_uuid(), 'Invoice delivered', NEW.created_by);
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER invoice_stock_transition AFTER UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION invoice_stock_transition();

CREATE FUNCTION guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE customers SET ledger_revision = ledger_revision + 1 WHERE id = NEW.customer_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_payment BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION guard_payment();
CREATE TRIGGER immutable_payment BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_allocation BEFORE UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_credit BEFORE UPDATE OR DELETE ON customer_credit_entries FOR EACH ROW EXECUTE FUNCTION reject_history_change();

CREATE FUNCTION guard_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE receipt payments; inv invoices; balance invoice_balances;
BEGIN
  SELECT * INTO receipt FROM payments WHERE id = NEW.payment_id;
  UPDATE customers SET ledger_revision = ledger_revision + 1 WHERE id = receipt.customer_id;
  SELECT * INTO inv FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
  SELECT * INTO balance FROM invoice_balances WHERE invoice_id = NEW.invoice_id;
  IF receipt.customer_id IS DISTINCT FROM inv.customer_id OR inv.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Payment customer must match an active invoice'; END IF;
  IF NEW.amount_applied > balance.remaining_balance THEN RAISE EXCEPTION 'Payment exceeds remaining balance'; END IF;
  IF EXISTS (SELECT 1 FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id
    WHERE i.customer_id = inv.customer_id AND i.cancelled_at IS NULL AND b.remaining_balance > 0
      AND (i.created_at, i.id) < (inv.created_at, inv.id)) THEN RAISE EXCEPTION 'Pay oldest invoice first'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_allocation BEFORE INSERT ON payment_allocations FOR EACH ROW EXECUTE FUNCTION guard_allocation();

CREATE FUNCTION guard_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source customer_credit_entries; inv invoices; used numeric;
BEGIN
  UPDATE customers SET ledger_revision = ledger_revision + 1 WHERE id = NEW.customer_id;
  IF NEW.entry_type = 'ISSUED' THEN
    IF NOT EXISTS (SELECT 1 FROM payments WHERE id = NEW.source_payment_id AND customer_id = NEW.customer_id) THEN RAISE EXCEPTION 'Credit must belong to payment customer'; END IF;
  ELSE
    SELECT * INTO source FROM customer_credit_entries WHERE id = NEW.source_credit_entry_id;
    SELECT * INTO inv FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
    SELECT coalesce(sum(amount), 0) INTO used FROM customer_credit_entries WHERE source_credit_entry_id = source.id;
    IF source.entry_type IS DISTINCT FROM 'ISSUED' OR source.customer_id IS DISTINCT FROM NEW.customer_id
       OR inv.customer_id IS DISTINCT FROM NEW.customer_id OR inv.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Credit source and invoice must belong to customer'; END IF;
    IF NEW.amount > source.amount - used THEN RAISE EXCEPTION 'Insufficient customer credit'; END IF;
    IF NEW.amount > (SELECT remaining_balance FROM invoice_balances WHERE invoice_id = NEW.invoice_id) THEN RAISE EXCEPTION 'Credit exceeds remaining invoice balance'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_credit BEFORE INSERT ON customer_credit_entries FOR EACH ROW EXECUTE FUNCTION guard_credit();

CREATE FUNCTION check_receipt_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid; received numeric; allocated numeric; issued numeric;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN pid := NEW.id;
  ELSIF TG_TABLE_NAME = 'payment_allocations' THEN pid := NEW.payment_id;
  ELSE pid := NEW.source_payment_id; END IF;
  IF pid IS NULL THEN RETURN NEW; END IF;
  SELECT received_amount INTO received FROM payments WHERE id = pid;
  SELECT coalesce(sum(amount_applied), 0) INTO allocated FROM payment_allocations WHERE payment_id = pid;
  SELECT coalesce(sum(amount), 0) INTO issued FROM customer_credit_entries WHERE source_payment_id = pid AND entry_type = 'ISSUED';
  IF received <> allocated + issued THEN RAISE EXCEPTION 'Receipt must equal allocations plus issued credit' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER receipt_total AFTER INSERT ON payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_receipt_total();
CREATE CONSTRAINT TRIGGER allocation_total AFTER INSERT ON payment_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_receipt_total();
CREATE CONSTRAINT TRIGGER credit_receipt_total AFTER INSERT ON customer_credit_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_receipt_total();

CREATE FUNCTION check_invoice_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE iid uuid; balance invoice_balances;
BEGIN
  iid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF iid IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO balance FROM invoice_balances WHERE invoice_id = iid;
  IF NOT EXISTS (SELECT 1 FROM invoice_items WHERE invoice_id = iid AND is_active) THEN RAISE EXCEPTION 'Invoice needs at least one item'; END IF;
  IF balance.total_amount < 0 OR balance.total_amount > 9999999999.99 OR balance.remaining_balance < 0 THEN
    RAISE EXCEPTION 'Invalid invoice total or settlements exceed amount due' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER invoice_total AFTER INSERT OR UPDATE ON invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_invoice_total('id');
CREATE CONSTRAINT TRIGGER item_invoice_total AFTER INSERT OR UPDATE ON invoice_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_invoice_total('invoice_id');
CREATE CONSTRAINT TRIGGER return_invoice_total AFTER INSERT OR UPDATE ON invoice_container_returns DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_invoice_total('invoice_id');

CREATE FUNCTION guard_supplier_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Supplier history cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' AND NEW.received_at IS NOT NULL THEN RAISE EXCEPTION 'Add lines before receiving a supplier order'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD.received_at IS NOT NULL OR (to_jsonb(NEW) - 'received_at') IS DISTINCT FROM (to_jsonb(OLD) - 'received_at')) THEN
    RAISE EXCEPTION 'Received supplier orders are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_supplier_order BEFORE INSERT OR UPDATE OR DELETE ON supplier_orders FOR EACH ROW EXECUTE FUNCTION guard_supplier_order();

CREATE FUNCTION guard_supplier_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE oid uuid;
BEGIN
  oid := coalesce(NEW.supplier_order_id, OLD.supplier_order_id);
  PERFORM 1 FROM supplier_orders WHERE id = oid AND received_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Received supplier order lines are immutable'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.supplier_order_id <> OLD.supplier_order_id THEN RAISE EXCEPTION 'Cannot move a supplier line'; END IF;
  RETURN coalesce(NEW, OLD);
END; $$;
CREATE TRIGGER guard_supplier_items BEFORE INSERT OR UPDATE OR DELETE ON supplier_order_items FOR EACH ROW EXECUTE FUNCTION guard_supplier_line();
CREATE TRIGGER guard_supplier_returns BEFORE INSERT OR UPDATE OR DELETE ON supplier_order_returns FOR EACH ROW EXECUTE FUNCTION guard_supplier_line();

CREATE FUNCTION receive_supplier_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item supplier_order_items;
BEGIN
  IF NEW.received_at IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM supplier_order_items WHERE supplier_order_id = NEW.id)
     OR (SELECT net_cost FROM supplier_order_totals WHERE id = NEW.id) < 0 THEN RAISE EXCEPTION 'Supplier order needs items and nonnegative net cost'; END IF;
  FOR item IN SELECT * FROM supplier_order_items WHERE supplier_order_id = NEW.id ORDER BY product_id, pack_code LOOP
    INSERT INTO inventory_movements(product_id, pack_code, kind, quantity_delta, supplier_order_item_id, request_key, reason, created_by)
    VALUES (item.product_id, item.pack_code, 'SUPPLIER_RECEIPT', item.quantity_cases, item.id, gen_random_uuid(), 'Supplier order received', NEW.created_by);
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER receive_supplier_order AFTER UPDATE ON supplier_orders FOR EACH ROW EXECUTE FUNCTION receive_supplier_order();
