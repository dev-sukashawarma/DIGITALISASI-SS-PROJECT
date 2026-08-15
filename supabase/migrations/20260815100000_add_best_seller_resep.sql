-- 20260815100000_add_best_seller_resep.sql
--
-- BUG (terverifikasi ke DB live 15 Aug 2026):
--   Dua menu item non-paket laku tapi TIDAK punya resep aktif, sehingga
--   trg_process_bom_stok tidak pernah memotong stok untuk penjualannya:
--
--     Best Seller 2           (8657f72e-...)  322 porsi / 7 hari
--     Best Seller (Mix Jumbo) (c698603b-...)  130 porsi / 7 hari
--
--   Diverifikasi lengkap: hanya 2 item ini yang laku tanpa resep. Seluruh
--   komponen paket/combo SUDAH punya resep (0 baris gap), jadi tidak ada
--   celah lain di sisi BOM.
--
-- KENAPA BUKAN "UPDATE menu_item_ref" (penting):
--   Memindahkan menu_item_ref resep "Shawarma Mix Jumbo" ke Best Seller
--   (seperti disarankan di BOM_BUG_FINDINGS_FULL.md Opsi A) justru MERUSAK:
--   resep itu satu-satunya milik "Original Mix Jumbo" yang laku 695 porsi/7hari.
--   Menambalnya untuk 130 porsi akan mematikan BOM 695 porsi. Karena itu di
--   sini resep BARU dibuat dengan komposisi disalin dari resep sumber.
--
-- KOMPOSISI (dikonfirmasi owner 15 Aug 2026):
--   Best Seller (Mix Jumbo) = Original Mix Jumbo  (AYAM 110g + SAPI 120g + 12 bahan)
--   Best Seller 2           = Original Sapi Jumbo (SAPI 170g + 13 bahan)
--   Keduanya versi diskon dari item jumbo (38rb vs 47rb; 34rb vs 42rb).
--
-- IDEMPOTEN: aman dijalankan ulang (guard NOT EXISTS di kedua level).
-- Timestamp sengaja tanggal HARI INI (bukan 2030) — ini murni migration DATA,
-- tidak mendefinisikan ulang fungsi apa pun, jadi tak perlu "jalan paling akhir".
-- Lihat scripts/migration-timestamp-lint.mjs.

BEGIN;

-- ============================================================
-- 1. Best Seller (Mix Jumbo)  <- salin dari "Shawarma Mix Jumbo"
-- ============================================================
INSERT INTO public.resep (nama, menu_item_ref, scope, is_active, buffer_amount, catatan)
SELECT
  'Shawarma Best Seller Mix Jumbo',
  'c698603b-7f43-415c-986c-b883445e783c',
  'global',
  true,
  src.buffer_amount,
  'Komposisi identik Original Mix Jumbo (versi harga Best Seller).'
FROM public.resep src
WHERE src.nama = 'Shawarma Mix Jumbo'
  AND src.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.resep r
    WHERE r.menu_item_ref = 'c698603b-7f43-415c-986c-b883445e783c'
      AND r.is_active
  );

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT tgt.id, ri.bahan_baku_id, ri.qty_per_porsi, ri.satuan
FROM public.resep tgt
JOIN public.resep src ON src.nama = 'Shawarma Mix Jumbo' AND src.is_active
JOIN public.resep_item ri ON ri.resep_id = src.id
WHERE tgt.menu_item_ref = 'c698603b-7f43-415c-986c-b883445e783c'
  AND tgt.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.resep_item x
    WHERE x.resep_id = tgt.id AND x.bahan_baku_id = ri.bahan_baku_id
  );

-- ============================================================
-- 2. Best Seller 2  <- salin dari "Shawarma Sapi Jumbo"
-- ============================================================
INSERT INTO public.resep (nama, menu_item_ref, scope, is_active, buffer_amount, catatan)
SELECT
  'Shawarma Best Seller 2 (Sapi Jumbo)',
  '8657f72e-d1a2-4829-a5cf-33535f7b293c',
  'global',
  true,
  src.buffer_amount,
  'Komposisi identik Original Sapi Jumbo (versi harga Best Seller).'
FROM public.resep src
WHERE src.nama = 'Shawarma Sapi Jumbo'
  AND src.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.resep r
    WHERE r.menu_item_ref = '8657f72e-d1a2-4829-a5cf-33535f7b293c'
      AND r.is_active
  );

INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT tgt.id, ri.bahan_baku_id, ri.qty_per_porsi, ri.satuan
FROM public.resep tgt
JOIN public.resep src ON src.nama = 'Shawarma Sapi Jumbo' AND src.is_active
JOIN public.resep_item ri ON ri.resep_id = src.id
WHERE tgt.menu_item_ref = '8657f72e-d1a2-4829-a5cf-33535f7b293c'
  AND tgt.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.resep_item x
    WHERE x.resep_id = tgt.id AND x.bahan_baku_id = ri.bahan_baku_id
  );

COMMIT;
