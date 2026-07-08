-- 20260708172000_fix_satuan_kecil_typos.sql
-- Fix incorrect satuan_kecil in bahan_baku for SAPI, MINYAK SAYUR, and GAS 3Kg.

UPDATE bahan_baku SET satuan_kecil = 'gram' WHERE nama = 'SAPI';
UPDATE bahan_baku SET satuan_kecil = 'ml' WHERE nama = 'MINYAK SAYUR';
UPDATE bahan_baku SET satuan_kecil = 'gram' WHERE nama = 'GAS 3Kg';
