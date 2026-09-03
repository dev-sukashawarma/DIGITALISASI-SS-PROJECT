-- 20300122000001_normalisasi_harga_batch2_4.sql
--
-- Lanjutan 20300122000000. Batch 2-4 normalisasi basis harga (31 bahan), plus
-- perbaikan harga_beli_display MINYAK. Dijalankan ke produksi 2 September 2026
-- lewat SQL Editor; file ini merekam apa yang benar-benar dijalankan.
--
-- BASIS KANONIK (sama seperti batch 1):
--   harga_beli  = harga per SATUAN BESAR
--   kemasan_qty = faktor PENUH (satuan kecil per satuan besar)
--
-- HASIL VERIFIKASI SESUDAHNYA (diukur ke DB live, bukan simulasi):
--   50 dari 55 bahan aktif sudah sesuai target konfirmasi.
--   harga_beli_display konsisten di semua baris kecuali 3 yang memang belum
--   dinormalkan (PLASTIK BESAR, TUTUP PACK belum dijawab; POLYBAG ditahan).
--   Uji penerimaan HPP dinamis vs hpp_override: -5,4% untuk 20 menu,
--   food cost rata-rata 53% (sebelumnya +160%).
--
-- BELUM MASUK, MENUNGGU KEPUTUSAN:
--   PLASTIK BESAR, SABUN, SEDOTAN, TUTUP PACK -- belum dijawab.
--   POLYBAG -- ditahan. Catatan owner "1 bal = 25 pak" bertentangan dengan
--     faktor_tengah = 5 yang tersimpan. Faktornya harus dipastikan lebih dulu;
--     menormalkan harga di atas faktor yang salah hanya memindahkan kesalahan.

-- ===== MINYAK -- harga & kemasan sudah benar, hanya display yang basi =====
-- Rp6.016.000, sisa rumus lama sebelum trigger diperbaiki. Karena harga tidak
-- berubah, trigger tidak menyala sendiri -- dipancing naik 1 rupiah lalu balik.
UPDATE public.bahan_baku_harga h SET harga_beli = h.harga_beli + 1
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'MINYAK';
UPDATE public.bahan_baku_harga h SET harga_beli = 376000
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'MINYAK';

-- ===== BATCH 2 — dipakai di resep (13 bahan, berdampak ke HPP) =====

UPDATE public.bahan_baku_harga h SET harga_beli = 42800, kemasan_qty = 25, kemasan_satuan = 'Pcs'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'CUP' AND h.harga_beli = 1780;

UPDATE public.bahan_baku_harga h SET harga_beli = 11554, kemasan_qty = 760, kemasan_satuan = 'cm'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'FOIL' AND h.harga_beli = 11554;

UPDATE public.bahan_baku_harga h SET harga_beli = 250000, kemasan_qty = 10000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'KENTANG' AND h.harga_beli = 250000;

UPDATE public.bahan_baku_harga h SET harga_beli = 248004, kemasan_qty = 12000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'MAYONAISE' AND h.harga_beli = 23706;

UPDATE public.bahan_baku_harga h SET harga_beli = 925000, kemasan_qty = 5000, kemasan_satuan = 'Lembar'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'PAPER WRAP' AND h.harga_beli = 160;

UPDATE public.bahan_baku_harga h SET harga_beli = 90000, kemasan_qty = 100, kemasan_satuan = 'Lembar'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'PLASTIK MERAH' AND h.harga_beli = 23500;

UPDATE public.bahan_baku_harga h SET harga_beli = 48474, kemasan_qty = 1000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'POWDER JERUK' AND h.harga_beli = 55250;

UPDATE public.bahan_baku_harga h SET harga_beli = 53950, kemasan_qty = 1000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'POWDER TEH' AND h.harga_beli = 55250;

UPDATE public.bahan_baku_harga h SET harga_beli = 244002, kemasan_qty = 16500, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SAOS CABE' AND h.harga_beli = 14179;

UPDATE public.bahan_baku_harga h SET harga_beli = 280000, kemasan_qty = 5000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SAOS SAMYANG' AND h.harga_beli = 14774;

UPDATE public.bahan_baku_harga h SET harga_beli = 140004, kemasan_qty = 12000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SAOS TOMAT POUCH' AND h.harga_beli = 10613;

UPDATE public.bahan_baku_harga h SET harga_beli = 100000, kemasan_qty = 2000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SAPI' AND h.harga_beli = 100000;

UPDATE public.bahan_baku_harga h SET harga_beli = 5300, kemasan_qty = 54, kemasan_satuan = 'Pcs'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'STIKER' AND h.harga_beli = 10000;


-- ===== BATCH 3 — tidak dipakai resep (11 bahan) =====

UPDATE public.bahan_baku_harga h SET harga_beli = 650000, kemasan_qty = 20000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'BAWANG' AND h.harga_beli = 650000;

UPDATE public.bahan_baku_harga h SET harga_beli = 271250, kemasan_qty = 250, kemasan_satuan = 'Pcs'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'DUS PACKING' AND h.harga_beli = 10250;

UPDATE public.bahan_baku_harga h SET harga_beli = 8791, kemasan_qty = 760, kemasan_satuan = 'cm'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'FOIL (48)' AND h.harga_beli = 11554;

UPDATE public.bahan_baku_harga h SET harga_beli = 90000, kemasan_qty = 5000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'GARAM' AND h.harga_beli = 90000;

UPDATE public.bahan_baku_harga h SET harga_beli = 5975, kemasan_qty = 100, kemasan_satuan = 'Lembar'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'HAND GLOVE' AND h.harga_beli = 5975;

UPDATE public.bahan_baku_harga h SET harga_beli = 34980, kemasan_qty = 250, kemasan_satuan = 'Lembar'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'PLASTIK KECIL' AND h.harga_beli = 6996;

UPDATE public.bahan_baku_harga h SET harga_beli = 880000, kemasan_qty = 2000, kemasan_satuan = 'Lembar'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'PLASTIK VACUM' AND h.harga_beli = 44000;

UPDATE public.bahan_baku_harga h SET harga_beli = 40436, kemasan_qty = 24, kemasan_satuan = 'Roll'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'PLASTIK VACUUM JUMBO' AND h.harga_beli = 44000;

UPDATE public.bahan_baku_harga h SET harga_beli = 170148, kemasan_qty = 12000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SAOS CABE POUCH' AND h.harga_beli = 14179;

UPDATE public.bahan_baku_harga h SET harga_beli = 187677, kemasan_qty = 16500, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SAOS TOMAT KOMPAN' AND h.harga_beli = 62559;

UPDATE public.bahan_baku_harga h SET harga_beli = 612000, kemasan_qty = 12000, kemasan_satuan = 'Gram'
  FROM public.bahan_baku b WHERE b.id = h.bahan_baku_id AND b.nama = 'SASA' AND h.harga_beli = 51000;


-- ===== BATCH 4 — harga baru, belum punya baris (7 bahan) =====

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 90000, 432, 'Sachet', now() FROM public.bahan_baku b
  WHERE b.nama = 'BAWANG PUTIH BUBUK'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 7000, 19000, 'Ml', now() FROM public.bahan_baku b
  WHERE b.nama = 'GALON AIR'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 2571, 1, 'Pcs', now() FROM public.bahan_baku b
  WHERE b.nama = 'ID CARD'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 195000, 1000, 'Gram', now() FROM public.bahan_baku b
  WHERE b.nama = 'MERICA'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 12000, 1, 'Pack', now() FROM public.bahan_baku b
  WHERE b.nama = 'PLASTIK 24'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 100000, 500, 'Lembar', now() FROM public.bahan_baku b
  WHERE b.nama = 'PLASTIK SUKA DRINK'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);

INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  SELECT b.id, 305317, 1, 'Unit', now() FROM public.bahan_baku b
  WHERE b.nama = 'PRINTER THERMAL'
    AND NOT EXISTS (SELECT 1 FROM public.bahan_baku_harga x WHERE x.bahan_baku_id = b.id);
