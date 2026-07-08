-- =============================================================================
-- FIX: Set satuan_kecil ke 'gram' dan faktor_tampilan ke 1000
-- untuk semua bahan baku yang bersatuan 'kg' agar pecahan di bawah 1 kg 
-- bisa ditampilkan di UI sebagai satuan kecil (gram).
-- =============================================================================

UPDATE public.bahan_baku
SET satuan_kecil = 'gram',
    faktor_tampilan = 1000
WHERE satuan = 'kg' 
  AND satuan_kecil IS NULL;
