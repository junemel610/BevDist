-- Update saved supplier costs and selling prices from the latest Recibo sheet.
-- Product names and suppliers must already exist; this migration never creates products.
-- The first supplied price is the supplier cost. The final Selling column is case_price.
WITH supplied_prices(supplier_name, product_name, supplier_cost, selling_price) AS (VALUES
  ('Coca-Cola', 'Coke Tall 8oz', 171.00, 206.00),
  ('Coca-Cola', 'Royal Tall 8oz', 171.00, 206.00),
  ('Coca-Cola', 'Sprite Tall 8oz', 171.00, 206.00),
  ('Coca-Cola', 'Coke Mismo', 192.00, 205.00),
  ('Coca-Cola', 'Royal Mismo', 192.00, 205.00),
  ('Coca-Cola', 'Sprite Mismo', 192.00, 205.00),
  ('Coca-Cola', 'Coke Kasalo', 258.00, 290.00),
  ('Coca-Cola', 'Royal Kasalo', 258.00, 290.00),
  ('Coca-Cola', 'Sprite Kasalo', 258.00, 290.00),
  ('Coca-Cola', 'Coke 1.5L', 712.00, 732.00),
  ('Coca-Cola', 'Royal 1.5L', 712.00, 732.00),
  ('Coca-Cola', 'Sprite 1.5L', 712.00, 732.00),
  ('Coca-Cola', 'Coke Zero 1.5L', 712.00, 732.00),
  ('Coca-Cola', 'Wilkins 500mL', 208.00, 228.00),
  ('Coca-Cola', 'Wilkins 1L', 174.00, 194.00),
  ('Coca-Cola', 'Wilkins 7L', 223.00, 243.00),
  ('Pepsi', 'Pepsi 8oz', 172.00, 207.00),
  ('Pepsi', 'Pepsi Mega', 256.00, 288.00),
  ('Pepsi', 'Sting', 282.00, 302.00),
  ('Pepsi', 'Gatorade', 291.00, 311.00),
  ('Pepsi', 'Tropicana', 291.00, 311.00),
  ('Pepsi', '7up 7oz', 169.00, 204.00),
  ('Pepsi', 'Sting Pet', 193.00, 213.00),
  ('Pepsi', 'Mountain Dew 8oz', 172.00, 207.00),
  ('Pepsi', 'Mountain Dew 12oz', 268.00, 303.00),
  ('Pepsi', 'Mountain Dew Mega', 256.00, 288.00),
  ('Pepsi', 'Mountain Dew Neon', 190.00, 210.00),
  ('Asia Brewery', 'Cobra', 280.00, 295.00),
  ('Asia Brewery', 'Vitamilk', 376.00, 396.00),
  ('Asia Brewery', 'Summit 350mL', 256.00, 252.20),
  ('Asia Brewery', 'Summit 500mL', 235.00, 229.00),
  ('Asia Brewery', 'Summit 1L', 199.00, 200.20),
  ('ARC Product', 'RC 8oz', 156.00, 171.00),
  ('ARC Product', 'Lemon Fruit Soda', 156.00, 176.00),
  ('ARC Product', 'Root Beer', 156.00, 176.00),
  ('ARC Product', 'Orange Fruit Soda', 156.00, 176.00),
  ('ARC Product', 'RC Mega', 235.00, 257.00),
  ('San Miguel', 'San Mig Beer', 903.00, 918.00),
  ('San Miguel', 'San Mig Light', 1041.00, 1056.00),
  ('San Miguel', 'Red Horse 500mL', 661.00, 676.00),
  ('San Miguel', 'Red Horse 1L', 641.00, 656.00),
  ('San Miguel', 'Stallion', 742.00, 979.00),
  ('San Miguel', 'San Mig Apple', 863.00, 878.00),
  ('San Miguel', 'Grande', 613.00, 628.00),
  ('Magnolia Product', 'Mag Lemon', 216.50, 231.50),
  ('Magnolia Product', 'Mag Apple', 216.50, 231.50),
  ('Magnolia Product', 'Mag Grapes', 216.50, 231.50),
  ('Magnolia Product', 'Mag Strawberry', 216.50, 231.50)
)
UPDATE product_case_packs pc
SET supplier_cost_per_case = prices.supplier_cost,
    case_price = prices.selling_price
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN supplied_prices prices
  ON prices.supplier_name = s.name
 AND lower(prices.product_name) = lower(p.name)
WHERE pc.product_id = p.id
  AND pc.pack_code = 'B'
  AND pc.is_active;
