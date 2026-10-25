UPDATE case_pack_types SET label = code WHERE code IN ('A', 'B', 'C');
UPDATE case_pack_types SET label = 'Mucho 6' WHERE code = 'MUCHO_6';
UPDATE case_pack_types SET label = 'Mucho 12' WHERE code = 'MUCHO_12';
WITH RECURSIVE numbered AS (
  SELECT code, row_number() OVER (ORDER BY code)::integer + 3 AS value
  FROM case_pack_types WHERE family = 'custom'
), letters AS (
  SELECT code, value AS remainder, ''::text AS label FROM numbered
  UNION ALL
  SELECT code, (remainder - 1) / 26,
         chr(65 + ((remainder - 1) % 26)) || label
  FROM letters WHERE remainder > 0
)
UPDATE case_pack_types AS packs
SET label = letters.label
FROM letters
WHERE packs.code = letters.code AND letters.remainder = 0;
