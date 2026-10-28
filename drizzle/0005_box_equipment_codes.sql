-- Renumber legacy automatic codes while preserving equipment IDs and loan links.
-- Allocate after existing BOX numbers to avoid unique-code collisions.
WITH legacy AS MATERIALIZED (
  SELECT id, created,
    CASE WHEN code GLOB 'PED-[0-9]*' THEN CAST(SUBSTR(code,5) AS INTEGER)
      ELSE CAST(SUBSTR(code,9) AS INTEGER) END AS old_number
  FROM equipment
  WHERE (code GLOB 'PED-[0-9]*' AND SUBSTR(code,5) NOT GLOB '*[^0-9]*')
     OR (code GLOB 'PED-KIT-[0-9]*' AND SUBSTR(code,9) NOT GLOB '*[^0-9]*')
), mapping AS MATERIALIZED (
  SELECT id, printf('BOX%03d',
    COALESCE((SELECT MAX(CAST(SUBSTR(code,4) AS INTEGER)) FROM equipment
      WHERE code GLOB 'BOX[0-9]*' AND SUBSTR(code,4) NOT GLOB '*[^0-9]*'),0)
    + ROW_NUMBER() OVER (ORDER BY old_number,created,id)) AS new_code
  FROM legacy
)
UPDATE equipment SET code=(SELECT new_code FROM mapping WHERE mapping.id=equipment.id)
WHERE id IN (SELECT id FROM mapping);
