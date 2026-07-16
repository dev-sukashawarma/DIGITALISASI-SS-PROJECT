-- Fix MAYONES missing satuan_distribusi due to name mismatch (was MAYONAISE in previous migration)
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'MAYONES';

-- Fix STIKER satuan_kecil so it matches its distribution unit (lembar) 
-- and correctly calculates 1 Roll = 100 lembar instead of 1
UPDATE bahan_baku SET satuan_kecil = 'lembar' WHERE nama = 'STIKER';
