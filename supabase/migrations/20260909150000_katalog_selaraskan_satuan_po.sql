-- 20260909150000_katalog_selaraskan_satuan_po.sql
-- Selaraskan katalog harga vendor dengan MASTER-SATUAN-PO-DAN-DISTRIBUSI.md:
-- baris yang BELUM berharga memakai satuan_po + faktor_po bahannya.
--
-- Permintaan owner 9 September 2026. Migration 20260909140000 sudah melakukan
-- ini untuk FOIL secara khusus; ini menggeneralkannya supaya baris seed
-- berikutnya tidak perlu tambalan per-bahan lagi.
--
-- Spec 4.1 katalog menetapkan default satuan_beli = bahan_baku.satuan_po.
-- Seed (20260908233000) sengaja menyimpang ke satuan BESAR karena
-- purchase_order_item.harga_terima tersimpan begitu -- benar untuk baris yang
-- membawa harga, tapi tak berguna untuk baris berharga 0: ia memaksa operator
-- mengetik harga per satuan besar padahal nota vendor memakai satuan PO.
--
-- ⚠️ PENJAGA: hanya baris harga = 0. Mengubah satuan pada baris berharga
-- TANPA mengubah angkanya menyalahkannya sebesar faktor konversi bahan --
-- persis mekanisme insiden FOIL Rp413,6 juta.
--
-- Idempoten.

UPDATE public.bahan_baku_supplier bs
   SET satuan_beli      = b.satuan_po,
       isi_satuan_kecil = b.faktor_po
  FROM public.bahan_baku b
 WHERE b.id = bs.bahan_baku_id
   AND bs.harga = 0
   AND b.satuan_po IS NOT NULL
   AND btrim(b.satuan_po) <> ''
   AND b.faktor_po IS NOT NULL
   AND b.faktor_po > 0
   AND (bs.satuan_beli IS DISTINCT FROM b.satuan_po
        OR bs.isi_satuan_kecil IS DISTINCT FROM b.faktor_po);

-- DOWN: tidak ada. Baris berharga 0 tak memuat angka yang perlu dipulihkan;
-- satuannya bisa disetel ulang lewat halaman katalog.
