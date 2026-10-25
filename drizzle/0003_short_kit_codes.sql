-- Rename only the former automatically generated UUID codes. IDs and loan links stay intact.
-- Materialize the mapping before updates so numeric allocation cannot change mid-statement.
WITH mapping AS MATERIALIZED (
  SELECT id, printf('PED-%04d',
    COALESCE((SELECT MAX(CAST(SUBSTR(code,5) AS INTEGER)) FROM equipment
      WHERE code GLOB 'PED-[0-9]*' AND SUBSTR(code,5) NOT GLOB '*[^0-9]*'),0)
    + ROW_NUMBER() OVER (ORDER BY created,id)) AS short_code
  FROM equipment
  WHERE LENGTH(code)=40 AND code GLOB 'PED-KIT-*'
    AND SUBSTR(code,9) NOT GLOB '*[^0-9A-F]*'
)
UPDATE equipment SET code=(SELECT short_code FROM mapping WHERE mapping.id=equipment.id)
WHERE id IN (SELECT id FROM mapping);
