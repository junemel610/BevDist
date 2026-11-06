-- The client tracks cases as a product-specific unit. Bottle counts are known
-- by the operator and are deliberately not represented in this application.
-- Existing mock business data must be reset before changing this unit model.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customers)
     OR EXISTS (SELECT 1 FROM suppliers)
     OR EXISTS (SELECT 1 FROM products)
     OR EXISTS (SELECT 1 FROM invoices)
     OR EXISTS (SELECT 1 FROM supplier_orders)
     OR EXISTS (SELECT 1 FROM inventory_movements) THEN
    RAISE EXCEPTION 'Reset mock business data before switching to the generic case unit';
  END IF;
END;
$$;

ALTER DOMAIN case_quantity DROP CONSTRAINT case_quantity_check;
ALTER DOMAIN case_quantity ADD CONSTRAINT case_quantity_check
  CHECK (VALUE >= 0 AND VALUE <= 99999999.5 AND mod(VALUE, 0.5) = 0);

ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_quantity_delta_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_quantity_delta_check
  CHECK (quantity_delta <> 0 AND abs(quantity_delta) <= 99999999.5 AND mod(quantity_delta, 0.5) = 0);

UPDATE case_pack_types SET is_active = (code = 'B');
UPDATE case_pack_types SET label = 'Case', units_per_case = 1, family = 'standard' WHERE code = 'B';
