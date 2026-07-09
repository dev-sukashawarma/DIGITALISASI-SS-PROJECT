-- 20260709000100_update_minyak_sayur_konversi.sql
-- Update faktor_konversi untuk MINYAK SAYUR menjadi 18000 (1 kompan = 18 liter).
-- Asumsi densitas 1L ~ 1kg (1000 gram).

UPDATE bahan_baku 
SET faktor_konversi = 18000 
WHERE nama = 'MINYAK SAYUR';

-- Update harga_beli untuk MINYAK SAYUR berdasarkan harga per liter/kg (23.000 / 1000 gram = 23 per gram)
-- 23 * 18000 = 414000
UPDATE bahan_baku_harga bbh
SET harga_beli = ROUND( (23000::numeric / 1000) * bb.faktor_konversi ),
    harga_updated_at = now()
FROM bahan_baku bb
WHERE bb.id = bbh.bahan_baku_id 
  AND bb.nama = 'MINYAK SAYUR';
