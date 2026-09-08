-- 20260908160000_tandai_satuan_baris_po_foil.sql
--
-- Menandai satuan asli dua baris PO FOIL. TIDAK mengubah satu angka pun.
--
-- LATAR
-- =====
-- Migration 20260908103000 mengubah satuan FOIL dari Roll menjadi Dus
-- (1 Dus = 48 Roll). Sesi itu menskala ulang 26 baris surat jalan yang masih
-- berjalan, tetapi riwayat purchase_order_item di luar lingkupnya. Akibatnya
-- dua baris PO kini terbaca "2.000 Dus" dan "1.000 Dus" padahal maksudnya Roll.
--
-- Ini BUKAN kesalahan operator: saat kedua PO dibuat (15 & 31 Agustus 2026)
-- satuan FOIL memang Roll, jadi labelnya benar pada waktunya.
--
-- KENAPA MENANDAI, BUKAN MENSKALA (keputusan owner, 8 September 2026)
-- ==================================================================
-- Uangnya sudah benar: subtotal = qty x harga persis (Rp17.582.400 dan
-- Rp11.554.000), dan po_payable_spv.total memakai kolom subtotal yang
-- tersimpan -- utang supplier tidak bergantung pada qty/harga sama sekali.
-- Menskala qty ke Dus akan membuat dokumen tidak lagi cocok dengan faktur
-- supplier yang menyebut 2.000 Roll, dan memasukkan pecahan berulang
-- (2.000/48) ke dokumen pembelian. Menandai satuannya menyimpan kebenaran
-- dalam bentuk terbaca mesin tanpa menyentuh angka mana pun.
--
-- AMAN KARENA INERT
-- =================
-- Semua pembaca satuan_ad_hoc memakainya sebagai CADANGAN setelah
-- bahan_baku.satuan, dan kedua baris ini punya bahan_baku_id:
--   verifikasi_terima_po      COALESCE(b.satuan, poi.satuan_ad_hoc, 'satuan')
--   PODetailView.tsx:393      bahan_baku?.satuan || satuan_ad_hoc || '--'
--   KitchenVerifikasiModal:86 bahan_baku?.satuan || satuan_ad_hoc || 'pcs'
--   VerifikasiTerimaModal:126 hanya dipakai saat baris ad-hoc
-- Jadi tampilan dan perilaku tidak berubah; nilainya tersedia untuk kueri
-- valuasi yang perlu tahu satuan asli baris tersebut.
--
-- IDEMPOTEN: hanya mengisi yang masih NULL, dan hanya dua id eksplisit.

UPDATE public.purchase_order_item
SET satuan_ad_hoc = 'Roll'
WHERE id IN (
  'e93e0843-11ff-4205-98e0-6bcc315c2085',  -- SPB/PO/VII/2026/021, 2.000 Roll
  '48c56761-bdde-4c42-b4f1-9c5b53aa22b6'   -- PO/KITCHEN/20260831/0002, 1.000 Roll
)
AND satuan_ad_hoc IS NULL;

-- CATATAN: PO/KITCHEN/20260902/0001 SENGAJA tidak disentuh -- baris itu memakai
-- bahan lama "FOIL (48) (DIGABUNG KE FOIL)" yang satuannya memang masih Roll,
-- jadi labelnya sudah benar.
