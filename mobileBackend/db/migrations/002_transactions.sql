CREATE SEQUENCE invoice_number_sequence;
CREATE SEQUENCE supplier_order_number_sequence;

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || lpad(nextval('invoice_number_sequence')::text, 8, '0')),
  customer_id uuid NOT NULL REFERENCES customers(id),
  request_key uuid NOT NULL UNIQUE,
  request_hash text NOT NULL,
  customer_name_snapshot text NOT NULL,
  customer_contact_snapshot text NOT NULL DEFAULT '',
  customer_address_snapshot text NOT NULL DEFAULT '',
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid NOT NULL REFERENCES app_users(id),
  CHECK (NOT (delivered_at IS NOT NULL AND cancelled_at IS NOT NULL)),
  CHECK (cancelled_at IS NULL OR nullif(btrim(cancellation_reason), '') IS NOT NULL)
);
CREATE INDEX invoices_customer_date ON invoices(customer_id, created_at, id);
CREATE INDEX invoices_created ON invoices(created_at);

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  product_id uuid NOT NULL,
  pack_code text NOT NULL,
  product_name_snapshot text NOT NULL,
  pack_label_snapshot text NOT NULL,
  units_per_case_snapshot integer NOT NULL CHECK (units_per_case_snapshot > 0),
  quantity_cases case_quantity NOT NULL CHECK (quantity_cases > 0),
  case_price_snapshot money_amount NOT NULL CHECK (case_price_snapshot > 0),
  line_total numeric GENERATED ALWAYS AS (round(quantity_cases * case_price_snapshot, 2)) STORED,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, pack_code) REFERENCES product_case_packs(product_id, pack_code)
);
CREATE INDEX invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX invoice_items_pack ON invoice_items(product_id, pack_code);
CREATE UNIQUE INDEX invoice_items_active_pack ON invoice_items(invoice_id, product_id, pack_code) WHERE is_active;

CREATE TABLE invoice_container_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  return_type_id uuid REFERENCES returned_case_types(id),
  label_snapshot text NOT NULL CHECK (btrim(label_snapshot) <> ''),
  quantity_cases case_quantity NOT NULL CHECK (quantity_cases > 0),
  refund_per_case_snapshot money_amount NOT NULL,
  refund_total numeric GENERATED ALWAYS AS (round(quantity_cases * refund_per_case_snapshot, 2)) STORED,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_returns_invoice ON invoice_container_returns(invoice_id);

CREATE TABLE inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id uuid NOT NULL REFERENCES invoice_items(id),
  quantity_cases case_quantity NOT NULL CHECK (quantity_cases > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'FINALIZED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK ((status = 'ACTIVE') = (closed_at IS NULL))
);
CREATE UNIQUE INDEX reservation_active_item ON inventory_reservations(invoice_item_id) WHERE status = 'ACTIVE';
CREATE INDEX reservation_item ON inventory_reservations(invoice_item_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  method text NOT NULL CHECK (method IN ('CASH', 'GCASH', 'BANK_TRANSFER')),
  received_amount money_amount NOT NULL CHECK (received_amount > 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  reference text,
  request_key uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES app_users(id)
);
CREATE INDEX payments_customer_date ON payments(customer_id, received_at);
CREATE TABLE payment_allocations (
  payment_id uuid NOT NULL REFERENCES payments(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount_applied money_amount NOT NULL CHECK (amount_applied > 0),
  allocation_order integer NOT NULL CHECK (allocation_order > 0),
  PRIMARY KEY (payment_id, invoice_id),
  UNIQUE (payment_id, allocation_order)
);
CREATE INDEX allocations_invoice ON payment_allocations(invoice_id);

-- Only confirmed issuance/application flows are enabled; no ambiguous adjustment amounts.
CREATE TABLE customer_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  entry_type text NOT NULL CHECK (entry_type IN ('ISSUED', 'APPLIED')),
  amount money_amount NOT NULL CHECK (amount > 0),
  source_payment_id uuid REFERENCES payments(id),
  source_credit_entry_id uuid REFERENCES customer_credit_entries(id),
  invoice_id uuid REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_users(id),
  CHECK ((entry_type = 'ISSUED' AND source_payment_id IS NOT NULL AND source_credit_entry_id IS NULL AND invoice_id IS NULL)
      OR (entry_type = 'APPLIED' AND source_payment_id IS NULL AND source_credit_entry_id IS NOT NULL AND invoice_id IS NOT NULL))
);
CREATE UNIQUE INDEX credit_payment_issue ON customer_credit_entries(source_payment_id) WHERE entry_type = 'ISSUED';
CREATE INDEX credit_customer_date ON customer_credit_entries(customer_id, created_at, id);
CREATE INDEX credit_source ON customer_credit_entries(source_credit_entry_id);
CREATE INDEX credit_invoice ON customer_credit_entries(invoice_id);

CREATE TABLE supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('SUP-' || lpad(nextval('supplier_order_number_sequence')::text, 8, '0')),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  supplier_name_snapshot text NOT NULL,
  request_key uuid NOT NULL UNIQUE,
  request_hash text NOT NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_users(id)
);
CREATE INDEX supplier_orders_supplier_date ON supplier_orders(supplier_id, received_at);
CREATE TABLE supplier_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id),
  product_id uuid NOT NULL,
  pack_code text NOT NULL,
  product_name_snapshot text NOT NULL,
  pack_label_snapshot text NOT NULL,
  units_per_case_snapshot integer NOT NULL CHECK (units_per_case_snapshot > 0),
  quantity_cases case_quantity NOT NULL CHECK (quantity_cases > 0),
  cost_per_case_snapshot money_amount NOT NULL CHECK (cost_per_case_snapshot > 0),
  line_total numeric GENERATED ALWAYS AS (round(quantity_cases * cost_per_case_snapshot, 2)) STORED,
  FOREIGN KEY (product_id, pack_code) REFERENCES product_case_packs(product_id, pack_code),
  UNIQUE (supplier_order_id, product_id, pack_code)
);
CREATE INDEX supplier_items_pack ON supplier_order_items(product_id, pack_code);
CREATE TABLE supplier_order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id),
  return_type_id uuid REFERENCES returned_case_types(id),
  label_snapshot text NOT NULL CHECK (btrim(label_snapshot) <> ''),
  quantity_cases case_quantity NOT NULL CHECK (quantity_cases > 0),
  refund_per_case_snapshot money_amount NOT NULL,
  refund_total numeric GENERATED ALWAYS AS (round(quantity_cases * refund_per_case_snapshot, 2)) STORED
);
CREATE INDEX supplier_returns_order ON supplier_order_returns(supplier_order_id);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  pack_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('OPENING', 'ADJUSTMENT', 'DELIVERY', 'SUPPLIER_RECEIPT')),
  quantity_delta numeric NOT NULL CHECK (quantity_delta <> 0 AND abs(quantity_delta) <= 99999999.5 AND mod(quantity_delta, 0.5) = 0),
  invoice_item_id uuid UNIQUE REFERENCES invoice_items(id),
  supplier_order_item_id uuid UNIQUE REFERENCES supplier_order_items(id),
  request_key uuid NOT NULL UNIQUE,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_users(id),
  FOREIGN KEY (product_id, pack_code) REFERENCES product_case_packs(product_id, pack_code),
  CHECK ((kind = 'DELIVERY' AND invoice_item_id IS NOT NULL AND supplier_order_item_id IS NULL AND quantity_delta < 0)
    OR (kind = 'SUPPLIER_RECEIPT' AND supplier_order_item_id IS NOT NULL AND invoice_item_id IS NULL AND quantity_delta > 0)
    OR (kind IN ('OPENING', 'ADJUSTMENT') AND invoice_item_id IS NULL AND supplier_order_item_id IS NULL)),
  CHECK (kind <> 'OPENING' OR quantity_delta > 0)
);
CREATE INDEX movements_pack_date ON inventory_movements(product_id, pack_code, created_at);
CREATE UNIQUE INDEX stock_opening_once ON inventory_movements(product_id, pack_code) WHERE kind = 'OPENING';

CREATE VIEW invoice_totals AS
SELECT i.id AS invoice_id,
  coalesce(lines.subtotal, 0) AS subtotal,
  coalesce(returns.refund_total, 0) AS container_refund_total,
  coalesce(lines.subtotal, 0) - coalesce(returns.refund_total, 0) AS total_amount
FROM invoices i
LEFT JOIN (SELECT invoice_id, sum(line_total) AS subtotal FROM invoice_items WHERE is_active GROUP BY invoice_id) lines ON lines.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, sum(refund_total) AS refund_total FROM invoice_container_returns WHERE is_active GROUP BY invoice_id) returns ON returns.invoice_id = i.id;

CREATE VIEW invoice_balances AS
SELECT i.id AS invoice_id, i.customer_id, i.due_date,
  t.subtotal, t.container_refund_total, t.total_amount,
  CASE WHEN i.cancelled_at IS NULL THEN t.total_amount ELSE 0 END AS amount_due,
  coalesce(p.amount, 0) AS payment_applied,
  coalesce(c.amount, 0) AS credit_applied,
  coalesce(p.amount, 0) + coalesce(c.amount, 0) AS amount_paid,
  CASE WHEN i.cancelled_at IS NOT NULL THEN 0 ELSE t.total_amount - coalesce(p.amount, 0) - coalesce(c.amount, 0) END AS remaining_balance
FROM invoices i JOIN invoice_totals t ON t.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, sum(amount_applied) AS amount FROM payment_allocations GROUP BY invoice_id) p ON p.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, sum(amount) AS amount FROM customer_credit_entries WHERE entry_type = 'APPLIED' GROUP BY invoice_id) c ON c.invoice_id = i.id;

CREATE VIEW invoice_summary AS
SELECT i.*, b.subtotal, b.container_refund_total, b.total_amount, b.amount_due,
 b.payment_applied, b.credit_applied, b.amount_paid, b.remaining_balance,
 CASE WHEN cancelled_at IS NOT NULL THEN 'CANCELLED'
      WHEN delivered_at IS NOT NULL AND remaining_balance = 0 THEN 'COMPLETED'
      ELSE 'PENDING' END AS status,
 CASE WHEN delivered_at IS NOT NULL THEN 'DELIVERED' ELSE 'PENDING' END AS delivery_status,
 CASE WHEN cancelled_at IS NOT NULL THEN 'cancelled' WHEN remaining_balance = 0 THEN 'paid'
      WHEN i.due_date < (now() AT TIME ZONE 'Asia/Manila')::date THEN 'overdue' ELSE 'unpaid' END AS balance_status
FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id;

CREATE VIEW inventory_stock AS
SELECT p.*,
 coalesce(m.total, 0) AS total_stock_cases,
 coalesce(r.reserved, 0) AS reserved_stock_cases,
 coalesce(m.total, 0) - coalesce(r.reserved, 0) AS available_stock_cases
FROM product_case_packs p
LEFT JOIN (SELECT product_id, pack_code, sum(quantity_delta) AS total FROM inventory_movements GROUP BY product_id, pack_code) m USING (product_id, pack_code)
LEFT JOIN (SELECT ii.product_id, ii.pack_code, sum(r.quantity_cases) AS reserved
 FROM inventory_reservations r JOIN invoice_items ii ON ii.id = r.invoice_item_id WHERE r.status = 'ACTIVE'
 GROUP BY ii.product_id, ii.pack_code) r USING (product_id, pack_code);

CREATE VIEW customer_credit_balances AS
SELECT customer_id, sum(CASE WHEN entry_type = 'ISSUED' THEN amount ELSE -amount END) AS available_credit
FROM customer_credit_entries GROUP BY customer_id;

CREATE VIEW supplier_order_totals AS
SELECT o.*, coalesce(i.cost, 0) AS product_cost, coalesce(r.refund, 0) AS returned_credit,
 coalesce(i.cost, 0) - coalesce(r.refund, 0) AS net_cost
FROM supplier_orders o
LEFT JOIN (SELECT supplier_order_id, sum(line_total) AS cost FROM supplier_order_items GROUP BY supplier_order_id) i ON i.supplier_order_id = o.id
LEFT JOIN (SELECT supplier_order_id, sum(refund_total) AS refund FROM supplier_order_returns GROUP BY supplier_order_id) r ON r.supplier_order_id = o.id;

-- Each receipt is counted once, before joining allocations or credit usage.
CREATE VIEW daily_payment_summary AS
SELECT (p.received_at AT TIME ZONE 'Asia/Manila')::date AS business_date, p.method,
 sum(p.received_amount) AS received_amount, sum(coalesce(a.applied, 0)) AS applied_amount,
 sum(p.received_amount - coalesce(a.applied, 0)) AS credit_issued
FROM payments p LEFT JOIN (SELECT payment_id, sum(amount_applied) AS applied FROM payment_allocations GROUP BY payment_id) a ON a.payment_id = p.id
GROUP BY 1, 2;

CREATE VIEW daily_credit_usage AS
SELECT (created_at AT TIME ZONE 'Asia/Manila')::date AS business_date, sum(amount) AS credit_used
FROM customer_credit_entries WHERE entry_type = 'APPLIED' GROUP BY 1;

CREATE VIEW daily_invoice_summary AS
SELECT (created_at AT TIME ZONE 'Asia/Manila')::date AS business_date,
 coalesce(sum(total_amount) FILTER (WHERE status <> 'CANCELLED'), 0) AS expected_sales,
 coalesce(sum(container_refund_total) FILTER (WHERE status <> 'CANCELLED'), 0) AS container_refunds,
 count(*) FILTER (WHERE status = 'COMPLETED') AS completed_invoices,
 count(*) FILTER (WHERE status = 'PENDING') AS pending_invoices,
 count(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_invoices
FROM invoice_summary GROUP BY 1;
