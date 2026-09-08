-- 20260908200000_polybag_harga_dan_satuan_baris_po.sql
--
-- Menutup dua hal terakhir yang menggantung di jendela 1 September, keduanya
-- berdasar keterangan owner 8 September 2026:
--
--   "polybag 1 bal harganya 600.000 isi 25 pack, 1 pack 24.000,
--    plastik merah 50 pack"
--
-- ============================================================================
-- 1. HARGA POLYBAG: Rp25.000 -> Rp24.000 per Pack
-- ============================================================================
-- ⚠ INI MENGUBAH ANGKA YANG SEBELUMNYA SUDAH DIKONFIRMASI.
-- Migration 20300122000003 (3 September) menetapkan Rp25.000 per Pack dan
-- menyebutnya "jawaban konfirmasi". Keterangan 8 September menyebut Rp24.000.
--
-- Yang baru dipakai karena punya dua penopang, bukan cuma ingatan:
--   a. Aritmetiknya tepat: Rp600.000 / 25 Pack = Rp24.000, tanpa sisa.
--   b. PO SPB/PO/VII/2026/039 (24 Agustus) mencatat 2 x Rp600.000 =
--      Rp1.200.000 -- persis 2 Bal, jadi Rp24.000/Pack.
-- Rp25.000 kemungkinan pembulatan saat konfirmasi lisan sebelumnya.
--
-- Struktur satuan TIDAK diubah. "Bal" adalah kemasan PEMBELIAN (25 Pack),
-- bukan tingkat satuan operasional. Keputusan 3 September tetap berlaku:
-- POLYBAG hanya punya Pack dan Pcs. Menambah tingkat di atas Pack akan
-- mengulang persoalan FOIL (dokumen historis berpindah arti diam-diam).
--
-- POLYBAG tidak dipakai resep mana pun, jadi HPP dan laba tidak tersentuh.

UPDATE public.bahan_baku_harga h
SET harga_beli = 24000
FROM public.bahan_baku b
WHERE b.id = h.bahan_baku_id AND b.nama = 'POLYBAG' AND h.harga_beli = 25000;

-- Harga beku surat jalan POLYBAG di jendela 1 September diseragamkan ke harga
-- yang dikonfirmasi itu, mengikuti kebijakan yang sama dengan 20260908190000
-- ("pakai harga sekarang, selisih audit disuntikkan belakangan"). Mencakup
-- baris lama Rp9.000 maupun baris Rp25.000.

UPDATE public.surat_jalan_item sji
SET harga_snapshot = 24000
FROM public.surat_jalan sj, public.bahan_baku b
WHERE sj.id = sji.surat_jalan_id AND b.id = sji.bahan_baku_id
  AND b.nama = 'POLYBAG'
  AND sji.harga_snapshot <> 24000
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

-- ============================================================================
-- 2. SATUAN ASLI DUA BARIS PO -- menandai, tanpa mengubah satu angka pun
-- ============================================================================
-- Pola yang sama dengan 20260908160000 (dua baris FOIL). Uangnya sudah benar
-- di keduanya; yang salah cuma label satuannya. po_payable_spv memakai kolom
-- subtotal yang tersimpan, jadi utang supplier tidak bergerak.
--
--   SPB/PO/VII/2026/039  POLYBAG        2 x 600.000 = Rp1.200.000
--                        tercatat "Pack", sebenarnya 2 BAL (= 50 Pack)
--   SPB/PO/VII/2026/036  PLASTIK MERAH  50 x 18.000 = Rp900.000
--                        tercatat "Ikat", sebenarnya 50 PACK (= 10 Ikat)
--
-- PLASTIK MERAH terbukti konsisten: master Rp90.000/Ikat dengan 1 Ikat =
-- 5 Pack berarti Rp18.000/Pack -- persis harga_terima-nya. Jadi masternya
-- benar dan hanya labelnya yang keliru.
--
-- satuan_ad_hoc inert untuk baris yang punya bahan_baku_id: semua pembacanya
-- memakainya sebagai cadangan setelah bahan_baku.satuan.

UPDATE public.purchase_order_item poi
SET satuan_ad_hoc = 'Bal'
FROM public.purchase_order po
WHERE po.id = poi.purchase_order_id
  AND po.nomor_po = 'SPB/PO/VII/2026/039'
  AND poi.satuan_ad_hoc IS NULL;

UPDATE public.purchase_order_item poi
SET satuan_ad_hoc = 'Pack'
FROM public.purchase_order po
WHERE po.id = poi.purchase_order_id
  AND po.nomor_po = 'SPB/PO/VII/2026/036'
  AND poi.satuan_ad_hoc IS NULL;

-- IDEMPOTEN: tiap UPDATE memakai syarat yang menjadi salah setelah dijalankan.
