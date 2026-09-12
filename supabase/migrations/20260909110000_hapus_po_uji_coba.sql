-- 20260909110000_hapus_po_uji_coba.sql
-- Buang satu PO sisa uji coba developer yang menggantung di daftar PO aktif.
--
-- `TEST/PO/PARTIAL/1787892515680` ("TEST SUPPLIER AYAM 1 TON"), dibuat
-- 28 Agustus 2026, berstatus `dikirim_ke_supplier` sehingga terus tampil
-- sebagai PO berjalan. Keputusan owner 9 Sep 2026: hapus, ini artefak testing.
--
-- Diverifikasi sebelum menghapus -- baris ini benar-benar cangkang kosong:
--   supplier_id               NULL  (nama supplier hanya teks denormalisasi,
--                                    tidak ada baris master yang ikut terhapus)
--   purchase_order_item       0 baris
--   bahan_baku_supplier       0 rujukan ref_po_id
--   bahan_baku_supplier_history 0 rujukan
--   bahan_baku_harga_history  0 rujukan
--   purchase_request          0 rujukan linked_po_id
-- Karena tak pernah diverifikasi, ia juga tak pernah menulis ledger.
--
-- Dihapus berdasarkan ID, bukan pola nama, supaya tidak ikut menyapu PO lain
-- yang kebetulan bernama mirip. Idempoten.

DELETE FROM public.purchase_order
 WHERE id = '1890185f-042f-43f8-bc7b-8135bb1f106a';

-- DOWN: tidak ada. Baris uji coba tanpa item; buat ulang lewat UI bila perlu.
