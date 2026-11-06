-- The distributor catalog is a real database directory. Prices stay unset
-- until the business supplies them; no mock price or physical stock is made up.
ALTER TABLE product_case_packs ALTER COLUMN case_price DROP NOT NULL;
ALTER TABLE product_case_packs DROP CONSTRAINT product_case_packs_case_price_check;
ALTER TABLE product_case_packs ADD CONSTRAINT product_case_packs_case_price_check
  CHECK (case_price IS NULL OR case_price > 0);

INSERT INTO suppliers(name)
VALUES ('Coca-Cola'), ('Pepsi'), ('Asia Brewery'), ('ARC Product'), ('San Miguel'), ('Magnolia Product')
ON CONFLICT (name) DO UPDATE SET is_active = true;

WITH catalog(supplier_name, product_name) AS (
  VALUES
    ('Coca-Cola','Coke Tall 8oz'), ('Coca-Cola','Royal Tall 8oz'), ('Coca-Cola','Sprite Tall 8oz'),
    ('Coca-Cola','Coke Mismo'), ('Coca-Cola','Royal Mismo'), ('Coca-Cola','Sprite Mismo'),
    ('Coca-Cola','Coke Kasalo'), ('Coca-Cola','Royal Kasalo'), ('Coca-Cola','Sprite Kasalo'),
    ('Coca-Cola','Coke 1.5L'), ('Coca-Cola','Royal 1.5L'), ('Coca-Cola','Sprite 1.5L'), ('Coca-Cola','Coke Zero 1.5L'),
    ('Coca-Cola','Minute Maid'), ('Coca-Cola','Wilkins 500mL'), ('Coca-Cola','Wilkins 1L'), ('Coca-Cola','Wilkins 7L'),
    ('Pepsi','Pepsi 8oz'), ('Pepsi','Mountain Dew 8oz'), ('Pepsi','Mountain Dew 12oz'), ('Pepsi','7up 7oz'),
    ('Pepsi','Mountain Dew Mega'), ('Pepsi','Pepsi Mega'), ('Pepsi','Mountain Dew Neon'),
    ('Pepsi','Sting'), ('Pepsi','Sting Pet'), ('Pepsi','Gatorade'), ('Pepsi','Tropicana'),
    ('Asia Brewery','Cobra'), ('Asia Brewery','Cobra Pet'), ('Asia Brewery','Vitamilk'), ('Asia Brewery','Vitachoco'),
    ('Asia Brewery','Summit 350mL'), ('Asia Brewery','Summit 500mL'), ('Asia Brewery','Summit 1L'),
    ('ARC Product','RC 8oz'), ('ARC Product','Lemon Fruit Soda'), ('ARC Product','Root Beer'), ('ARC Product','RC Mega'), ('ARC Product','Orange Fruit Soda'),
    ('San Miguel','Red Horse 500mL'), ('San Miguel','Red Horse 1L'), ('San Miguel','Grande'), ('San Miguel','San Mig Light'),
    ('San Miguel','San Mig Beer'), ('San Miguel','Stallion'), ('San Miguel','San Mig Apple'),
    ('Magnolia Product','Mag Apple'), ('Magnolia Product','Mag Lemon'), ('Magnolia Product','Mag Grapes'), ('Magnolia Product','Mag Strawberry')
)
INSERT INTO products(supplier_id, name)
SELECT s.id, c.product_name
FROM catalog c JOIN suppliers s ON s.name = c.supplier_name
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.supplier_id = s.id AND lower(btrim(p.name)) = lower(btrim(c.product_name))
);

-- Every directory product uses the app's single generic Case unit. A missing
-- movement means zero physical stock; staff enter actual stock in Inventory.
INSERT INTO product_case_packs(product_id, pack_code, case_price)
SELECT p.id, 'B', NULL
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
WHERE s.name IN ('Coca-Cola', 'Pepsi', 'Asia Brewery', 'ARC Product', 'San Miguel', 'Magnolia Product')
  AND p.is_active
ON CONFLICT (product_id, pack_code) DO UPDATE SET is_active = true;
