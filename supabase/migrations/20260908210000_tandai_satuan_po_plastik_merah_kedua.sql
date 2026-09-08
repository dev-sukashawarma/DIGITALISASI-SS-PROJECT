-- 20260908210000_tandai_satuan_po_plastik_merah_kedua.sql
--
-- Menandai satuan asli SATU baris PO lagi. Nol angka berubah.
--
-- PO/KITCHEN/20260907/0007 (7 September) mengulang kekeliruan yang sama dengan
-- SPB/PO/VII/2026/036: mengisi Rp18.000 sementara satuan PLASTIK MERAH adalah
-- Ikat. Master Rp90.000/Ikat dengan 1 Ikat = 5 Pack berarti Rp18.000/Pack --
-- jadi angkanya harga per PACK, bukan per Ikat.
--
-- GUARD SALAH SATUAN (20260904120000) SUDAH MENANGKAPNYA. Riwayat mencatat:
--   "DITOLAK (dugaan salah satuan): PO PO/KITCHEN/20260907/0007 mengisi
--    Rp 18000 per Ikat, rasio 5.00x terhadap master"
-- Master selamat di Rp90.000. Yang tersisa hanya baris PO-nya sendiri, yang
-- memang sengaja disimpan apa adanya oleh guard supaya selisihnya terlihat.
--
-- ⚠️ POLANYA BERULANG, DAN ITU BUKAN SOAL DATA.
-- Dua PO berbeda, dua bulan berbeda, kekeliruan yang sama: operator mengisi
-- harga per Pack pada bahan bersatuan Ikat. Menambal baris ketiga, keempat,
-- dst tidak akan menghentikannya. Perbaikan sesungguhnya ada di form terima
-- PO -- labelnya harus menyebut satuan bahan itu secara eksplisit
-- ("Harga per Ikat"), bukan label generik. Dicatat sebagai pekerjaan terpisah.

UPDATE public.purchase_order_item poi
SET satuan_ad_hoc = 'Pack'
FROM public.purchase_order po
WHERE po.id = poi.purchase_order_id
  AND po.nomor_po = 'PO/KITCHEN/20260907/0007'
  AND poi.satuan_ad_hoc IS NULL;

-- IDEMPOTEN lewat syarat IS NULL.
