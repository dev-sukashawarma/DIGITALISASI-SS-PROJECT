-- 20260704150000_cogs_fix_variable_packaging_satuan.sql
-- Owner (2026-07-04) konfirmasi: KENTANG, MAYONES, SAOS SAMYANG punya kemasan yang
-- BERUBAH-UBAH (bukan angka tetap) -- sama seperti SAUS CABE/TOMAT (migration
-- 20260704110000) dan PLASTIK MERAH (migration 20260704120000):
--   - KENTANG: pack kecil 1kg, pack besar 2,5kg
--   - MAYONES: "sama kaya saos" -> kompan 5,5kg / pouch 1kg
--   - SAOS SAMYANG: pouch besar 1kg, pouch kecil 250 gram
-- Solusi: satuan stok diubah ke KG, dicatat berdasarkan berat aktual yang diterima,
-- apapun ukuran kemasannya (bukan per-pack/per-pouch/per-crt).
--
-- FOIL: karton VARIABEL (kecil 24 roll, besar 48 roll) TAPI per-roll TETAP
-- (30cm x 7,6m = 760cm/roll). Solusi: hitung per ROLL (bukan per karton).
-- satuan = 'pcs' (1 pcs = 1 roll) -- 'roll' bukan nilai valid di CHECK constraint.

UPDATE bahan_baku SET satuan = 'kg' WHERE nama = 'KENTANG' AND satuan = 'pack';
UPDATE bahan_baku SET satuan = 'kg' WHERE nama = 'MAYONES' AND satuan = 'crt';
UPDATE bahan_baku SET satuan = 'kg' WHERE nama = 'SAOS SAMYANG' AND satuan = 'crt';
UPDATE bahan_baku SET satuan = 'pcs' WHERE nama = 'FOIL' AND satuan = 'crt';
