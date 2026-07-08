-- 20260708150000_fix_saos_faktor_konversi.sql
-- Fix faktor_konversi missing for new SAOS items

UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama IN ('SAOS CABE', 'SAOS TOMAT');
