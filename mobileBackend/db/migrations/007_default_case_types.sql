-- New products use the two case formats currently stocked by the client.
-- Existing product assignments and historical invoice snapshots remain available.
UPDATE case_pack_types SET is_active = false WHERE code IN ('C', 'MUCHO_6', 'MUCHO_12');
