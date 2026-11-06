ALTER TABLE invoice_container_returns
  ADD COLUMN entry_kind text NOT NULL DEFAULT 'return'
  CHECK (entry_kind IN ('deposit', 'return'));

CREATE OR REPLACE VIEW invoice_totals AS
SELECT i.id AS invoice_id,
  coalesce(lines.subtotal, 0) AS subtotal,
  coalesce(adjustments.refund_total, 0) AS container_refund_total,
  coalesce(lines.subtotal, 0) + coalesce(adjustments.deposit_total, 0) - coalesce(adjustments.refund_total, 0) AS total_amount,
  coalesce(adjustments.deposit_total, 0) AS container_deposit_total
FROM invoices i
LEFT JOIN (
  SELECT invoice_id, sum(line_total) AS subtotal
  FROM invoice_items WHERE is_active GROUP BY invoice_id
) lines ON lines.invoice_id = i.id
LEFT JOIN (
  SELECT invoice_id,
    sum(refund_total) FILTER (WHERE entry_kind = 'return') AS refund_total,
    sum(refund_total) FILTER (WHERE entry_kind = 'deposit') AS deposit_total
  FROM invoice_container_returns WHERE is_active GROUP BY invoice_id
) adjustments ON adjustments.invoice_id = i.id;

CREATE OR REPLACE VIEW invoice_balances AS
SELECT i.id AS invoice_id, i.customer_id, i.due_date,
  t.subtotal, t.container_refund_total, t.total_amount,
  CASE WHEN i.cancelled_at IS NULL THEN t.total_amount ELSE 0 END AS amount_due,
  coalesce(p.amount, 0) AS payment_applied,
  coalesce(c.amount, 0) AS credit_applied,
  coalesce(p.amount, 0) + coalesce(c.amount, 0) AS amount_paid,
  CASE WHEN i.cancelled_at IS NOT NULL THEN 0 ELSE t.total_amount - coalesce(p.amount, 0) - coalesce(c.amount, 0) END AS remaining_balance,
  t.container_deposit_total
FROM invoices i JOIN invoice_totals t ON t.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, sum(amount_applied) AS amount FROM payment_allocations GROUP BY invoice_id) p ON p.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, sum(amount) AS amount FROM customer_credit_entries WHERE entry_type = 'APPLIED' GROUP BY invoice_id) c ON c.invoice_id = i.id;

CREATE OR REPLACE VIEW invoice_summary AS
SELECT i.*, b.subtotal, b.container_refund_total, b.total_amount, b.amount_due,
 b.payment_applied, b.credit_applied, b.amount_paid, b.remaining_balance,
 CASE WHEN cancelled_at IS NOT NULL THEN 'CANCELLED'
      WHEN delivered_at IS NOT NULL AND remaining_balance = 0 THEN 'COMPLETED'
      ELSE 'PENDING' END AS status,
 CASE WHEN delivered_at IS NOT NULL THEN 'DELIVERED' ELSE 'PENDING' END AS delivery_status,
 CASE WHEN cancelled_at IS NOT NULL THEN 'cancelled' WHEN remaining_balance = 0 THEN 'paid'
      WHEN i.due_date < (now() AT TIME ZONE 'Asia/Manila')::date THEN 'overdue' ELSE 'unpaid' END AS balance_status,
 b.container_deposit_total
FROM invoices i JOIN invoice_balances b ON b.invoice_id = i.id;
