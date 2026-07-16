-- Fix satuan_kecil for SAOS CABE to 'gram' (was 'Kg' mistakenly)
-- This ensures getDistribusiFactor calculates 1 Dus = 16500 grams instead of 1 Dus = 16500 Kg
UPDATE bahan_baku 
SET satuan_kecil = 'gram'
WHERE nama = 'SAOS CABE';
