-- Keep supplier purchase cost beside, but independent from, the selling price.
ALTER TABLE product_case_packs
  ADD COLUMN supplier_cost_per_case money_amount;

-- Existing configured products start with matching purchase and selling prices.
UPDATE product_case_packs
SET supplier_cost_per_case = case_price
WHERE case_price IS NOT NULL;

-- Apply the supplied price list only to products already in the saved catalog.
-- Unknown abbreviations/products are intentionally left untouched.
WITH supplied_prices(supplier_name, product_name, price) AS (VALUES
  ('Coca-Cola', 'Coke Tall 8oz', 171.00),
  ('Coca-Cola', 'Royal Tall 8oz', 171.00),
  ('Coca-Cola', 'Sprite Tall 8oz', 171.00),
  ('Coca-Cola', 'Coke Mismo', 192.00),
  ('Coca-Cola', 'Royal Mismo', 192.00),
  ('Coca-Cola', 'Sprite Mismo', 192.00),
  ('Coca-Cola', 'Coke Kasalo', 258.00),
  ('Coca-Cola', 'Royal Kasalo', 258.00),
  ('Coca-Cola', 'Sprite Kasalo', 258.00),
  ('Coca-Cola', 'Coke 1.5L', 712.00),
  ('Coca-Cola', 'Royal 1.5L', 712.00),
  ('Coca-Cola', 'Sprite 1.5L', 712.00),
  ('Coca-Cola', 'Coke Zero 1.5L', 712.00),
  ('Coca-Cola', 'Minute Maid', 125.00),
  ('Coca-Cola', 'Wilkins 500mL', 80.00),
  ('Coca-Cola', 'Wilkins 1L', 174.00),
  ('Coca-Cola', 'Wilkins 7L', 223.00),
  ('Pepsi', 'Pepsi 8oz', 172.00),
  ('Pepsi', 'Mountain Dew 8oz', 172.00),
  ('Pepsi', 'Mountain Dew 12oz', 268.00),
  ('Pepsi', 'Mountain Dew Mega', 256.00),
  ('Pepsi', 'Pepsi Mega', 256.00),
  ('Pepsi', 'Mountain Dew Neon', 702.00),
  ('Pepsi', 'Sting', 282.00),
  ('Pepsi', 'Sting Pet', 190.00),
  ('Pepsi', 'Gatorade', 291.00),
  ('Pepsi', 'Tropicana', 291.00),
  ('Pepsi', '7up 7oz', 169.00),
  ('Asia Brewery', 'Cobra', 280.00),
  ('Asia Brewery', 'Vitamilk', 376.00),
  ('Asia Brewery', 'Summit 350mL', 256.00),
  ('Asia Brewery', 'Summit 500mL', 235.00),
  ('Asia Brewery', 'Summit 1L', 199.00),
  ('ARC Product', 'RC 8oz', 156.00),
  ('ARC Product', 'Lemon Fruit Soda', 156.00),
  ('ARC Product', 'Root Beer', 156.00),
  ('ARC Product', 'Orange Fruit Soda', 156.00),
  ('ARC Product', 'RC Mega', 235.00),
  ('San Miguel', 'Red Horse 500mL', 661.00),
  ('San Miguel', 'Red Horse 1L', 641.00),
  ('San Miguel', 'Grande', 613.00),
  ('San Miguel', 'San Mig Light', 1041.00),
  ('San Miguel', 'San Mig Beer', 903.00),
  ('San Miguel', 'Stallion', 742.00),
  ('San Miguel', 'San Mig Apple', 863.00),
  ('Magnolia Product', 'Mag Apple', 216.50),
  ('Magnolia Product', 'Mag Lemon', 216.50),
  ('Magnolia Product', 'Mag Grapes', 216.50),
  ('Magnolia Product', 'Mag Strawberry', 216.50)
)
UPDATE product_case_packs pc
SET case_price = prices.price,
    supplier_cost_per_case = prices.price
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN supplied_prices prices
  ON prices.supplier_name = s.name
 AND lower(prices.product_name) = lower(p.name)
WHERE pc.product_id = p.id
  AND pc.pack_code = 'B'
  AND pc.is_active;
