ALTER TABLE case_pack_types DROP CONSTRAINT case_pack_types_family_check;
ALTER TABLE case_pack_types ADD CONSTRAINT case_pack_types_family_check
  CHECK (family IN ('standard', 'mucho', 'custom'));
