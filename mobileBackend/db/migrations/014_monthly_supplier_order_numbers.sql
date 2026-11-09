-- Supplier order numbers follow the invoice's Manila monthly counter format.
CREATE TABLE supplier_order_number_counters (
  month_key text PRIMARY KEY CHECK (month_key ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
  last_number bigint NOT NULL CHECK (last_number > 0)
);

CREATE FUNCTION next_monthly_supplier_order_number(p_at timestamptz DEFAULT clock_timestamp())
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  period text := to_char(p_at AT TIME ZONE 'Asia/Manila', 'MMYYYY');
  next_number bigint;
BEGIN
  INSERT INTO supplier_order_number_counters(month_key, last_number)
  VALUES (
    period,
    COALESCE((
      SELECT max(split_part(order_number, '-', 3)::bigint)
      FROM supplier_orders
      WHERE order_number ~ ('^ORD-' || period || '-[0-9]{8}$')
    ), 0) + 1
  )
  ON CONFLICT (month_key) DO UPDATE
    SET last_number = supplier_order_number_counters.last_number + 1
  RETURNING last_number INTO next_number;

  RETURN 'ORD-' || period || '-' || lpad(next_number::text, 8, '0');
END;
$$;

ALTER TABLE supplier_orders ALTER COLUMN order_number
  SET DEFAULT next_monthly_supplier_order_number();
