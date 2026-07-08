-- 20260708160000_merge_saus_tomat_duplicate.sql
-- Merge SAUS TOMAT (crt) duplicate into SAOS TOMAT (kg)

-- 1. Update the resep_item for Resep Original Mix Jumbo (if it hasn't been merged)
-- Since the JS script already ran, this is for tracking.
-- delete SAUS TOMAT (crt) 44f9b147-d65a-4a46-b031-8a939a195201
-- update SAOS TOMAT (kg) 841dc31e-a5c0-4a8d-b599-eead717108cc

DELETE FROM public.resep_item 
WHERE resep_id = '3410ab1b-dcbf-4431-8276-7e0e8eca9331' 
AND bahan_baku_id = '44f9b147-d65a-4a46-b031-8a939a195201';

UPDATE public.bahan_baku 
SET is_active = false 
WHERE id = '44f9b147-d65a-4a46-b031-8a939a195201';
