-- 20260704190000_cogs_refill_stok_empang.sql
-- Isi stok awal 25 bahan yang dipakai 21 resep, khusus outlet SUKA SHAWARMA EMPANG
-- (550e8400-e29b-41d4-a716-446655440002), untuk keperluan testing BOM automation
-- (Tahap C) dan operasional awal. Owner (2026-07-04): "isi sesuai kebutuhan, kalau
-- lebih gapapa".
--
-- Angka dihitung dari total qty_per_porsi semua 21 resep (kalau 1 dari tiap produk
-- terjual sekali) dikali buffer 50x, dikonversi ke satuan stok via faktor_konversi,
-- dibulatkan ke atas ke angka yang masuk akal secara fisik (mis. KEJU dibulatkan ke
-- 1 karton utuh, bukan 0,84 karton).
--
-- tipe='terima_kiriman' (bukan 'adjustment') karena ini merepresentasikan stok masuk
-- yang sesungguhnya, bukan koreksi.

INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT '550e8400-e29b-41d4-a716-446655440002', b.id, 'terima_kiriman', v.qty,
       'Isi stok awal utk testing BOM automation Empang (2026-07-04)'
FROM (VALUES
  ('AYAM', 60),
  ('SAPI', 25),
  ('KULIT 25', 33),
  ('KULIT 28', 8),
  ('KULIT 32', 8),
  ('SAUS CABE/TOMAT', 45),
  ('MAYONES', 30),
  ('TUM', 6),
  ('MINYAK SAYUR', 2),
  ('KENTANG', 56),
  ('PAPER WRAP', 800),
  ('PLASTIK MERAH', 850),
  ('GAS 3Kg', 15),
  ('FOIL', 42),
  ('LETTUCE', 50),
  ('TEPUNG', 5),
  ('KEJU', 1),
  ('MIE', 100),
  ('POWDER MIX', 2),
  ('CUP + TUTUP', 50),
  ('STIKER', 50),
  ('ES BATU', 50),
  ('PLASTIK VACUM', 150),
  ('DUS PACKING', 150),
  ('SAOS SAMYANG', 4)
) AS v(nama, qty)
JOIN bahan_baku b ON b.nama = v.nama;
