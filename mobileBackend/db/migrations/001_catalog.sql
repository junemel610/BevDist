-- Preserve exact values: reject excess decimal places instead of rounding input.
CREATE DOMAIN money_amount AS numeric
  CHECK (VALUE >= 0 AND VALUE <= 9999999999.99 AND VALUE = round(VALUE, 2));
CREATE DOMAIN case_quantity AS numeric
  CHECK (VALUE >= 0 AND VALUE <= 99999999.5 AND mod(VALUE, 0.5) = 0);

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL CHECK (btrim(username) <> ''),
  password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
  session_version integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_users_username_unique ON app_users(lower(username));

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  contact text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  contact text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE case_pack_types (
  code text PRIMARY KEY,
  label text NOT NULL,
  units_per_case integer NOT NULL CHECK (units_per_case > 0),
  family text NOT NULL CHECK (family IN ('standard', 'mucho')),
  is_active boolean NOT NULL DEFAULT true
);
INSERT INTO case_pack_types(code, label, units_per_case, family) VALUES
  ('A', 'A · 12 bottles/case', 12, 'standard'),
  ('B', 'B · 24 bottles/case', 24, 'standard'),
  ('C', 'C · 6 bottles/case', 6, 'standard'),
  ('MUCHO_6', '6 bottles/case', 6, 'mucho'),
  ('MUCHO_12', '12 bottles/case', 12, 'mucho');

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  name text NOT NULL CHECK (btrim(name) <> ''),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_supplier ON products(supplier_id);
CREATE TABLE product_case_packs (
  product_id uuid NOT NULL REFERENCES products(id),
  pack_code text NOT NULL REFERENCES case_pack_types(code),
  case_price money_amount NOT NULL CHECK (case_price > 0),
  low_stock_threshold_cases case_quantity NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (product_id, pack_code)
);
-- Physical and reserved stock are derived from ledgers, never separately editable.
CREATE TABLE returned_case_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE CHECK (btrim(label) <> ''),
  refund_per_case money_amount NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
-- No invented production refund values or demo customers are seeded.
