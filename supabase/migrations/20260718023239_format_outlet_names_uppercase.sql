-- Up migration
-- 1. Convert all outlet names to uppercase
UPDATE public.outlets
SET name = UPPER(name);

-- 2. Remove "SUKA SHAWARMA" or "SUKA" from MITRA names
UPDATE public.outlets
SET name = REPLACE(name, 'MITRA SUKA SHAWARMA', 'MITRA')
WHERE name LIKE '%MITRA SUKA SHAWARMA%';

UPDATE public.outlets
SET name = REPLACE(name, 'MITRA SUKA ', 'MITRA ')
WHERE name LIKE '%MITRA SUKA %';

-- 3. Clean up double spaces if any
UPDATE public.outlets
SET name = REPLACE(name, '  ', ' ')
WHERE name LIKE '%  %';
