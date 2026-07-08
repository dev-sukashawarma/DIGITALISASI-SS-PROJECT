-- 20260708170000_resync_harga_beli_display.sql
-- Force recalculation of harga_beli_display for SAOS CABE and SAOS TOMAT 
-- because their faktor_konversi was updated after the initial insert.

UPDATE bahan_baku_harga h
SET harga_beli_display = (h.harga_beli / COALESCE(b.faktor_konversi, 1)) * COALESCE(h.kemasan_qty, 1)
FROM bahan_baku b
WHERE h.bahan_baku_id = b.id 
  AND b.nama IN ('SAOS CABE', 'SAOS TOMAT');
