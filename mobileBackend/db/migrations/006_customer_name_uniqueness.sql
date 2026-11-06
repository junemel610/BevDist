-- Serialize normalized name checks to prevent concurrent duplicate customer creation.
-- Existing duplicates remain intact for manual, history-aware cleanup.
CREATE FUNCTION guard_customer_name() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE normalized_name text;
BEGIN
  normalized_name := lower(btrim(NEW.name));
  IF TG_OP = 'UPDATE' AND normalized_name = lower(btrim(OLD.name)) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_name, 0));
  IF NEW.is_active AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.is_active AND c.id IS DISTINCT FROM NEW.id
      AND lower(btrim(c.name)) = normalized_name
  ) THEN
    RAISE EXCEPTION 'A customer with this name already exists'
      USING ERRCODE = '23505', CONSTRAINT = 'customers_normalized_name_unique';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_normalized_name_guard
BEFORE INSERT OR UPDATE OF name, is_active ON customers
FOR EACH ROW EXECUTE FUNCTION guard_customer_name();
