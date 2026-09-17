-- 20260917100000_koreksi_satuan_po_foil_ekadharma_15sep.sql
--
-- Koreksi PO/KITCHEN/20260915/0003 (FOIL, Ekadharma International, dibuat
-- 15 September 2026). qty_pesan tersimpan 1.000 "Dus" dan harga_pesan
-- Rp11.554/Dus -- keduanya adalah angka per ROLL yang salah dilabeli Dus.
--
-- BUKTI
-- =====
-- Rp11.554 persis harga katalog Ekadharma PER ROLL (bahan_baku_supplier,
-- isi_satuan_kecil=760 cm), bukan per Dus (1 Dus = 48 Roll sejak migrasi
-- 20260908103000). Harga per Dus yang benar = 11.554 x 48 = 554.592 --
-- angka yang sama persis dengan konversi katalog yang sudah diverifikasi
-- di sesi 2026-09-12 (lihat CLAUDE.md, entri "Saldo per Vendor Gudang
-- Pusat"). 1.000 Dus FOIL juga tidak masuk akal secara fisik (= 48.000
-- Roll); 1.000 Roll wajar untuk satu pengiriman Ekadharma.
--
-- Bukan kesalahan operator berulang seperti dua PO Agustus yang sudah
-- ditandai migrasi 20260908160000 -- PO ini dibuat SETELAH FOIL pindah ke
-- Dus, jadi form input semestinya sudah dalam Dus. Form PO belum memakai
-- bahan_baku.satuan_po/faktor_po (lihat memori "satuan_po butuh
-- faktor_po") sehingga operator yang berpikir dalam Roll (satuan asli
-- faktur Ekadharma) mengetik angka Roll ke kolom yang dibaca sistem
-- sebagai Dus.
--
-- AMAN: qty_terima & harga_terima masih NULL (status dikirim_ke_supplier,
-- dicek sebelum migrasi ini ditulis) -- belum ada baris ledger_stok yang
-- ditulis dari PO ini, jadi tidak ada koreksi stok yang menyusul.
--
-- Uang tidak bergeser: qty x harga = 1.000 x 11.554 = 1.000/48 x 554.592
-- = Rp11.554.000, identik sebelum & sesudah.
--
-- satuan_ad_hoc diisi 'Roll' sebagai penanda dokumentasi (pola yang sama
-- dengan migrasi 20260908160000) -- INERT untuk tampilan (semua pembaca
-- memakai COALESCE(bahan_baku.satuan, satuan_ad_hoc, ...) dan bahan_baku.
-- satuan untuk FOIL selalu 'Dus'), tapi menyimpan kebenaran satuan asli
-- baris ini untuk kueri valuasi di masa depan.
--
-- Idempoten.

UPDATE public.purchase_order_item
   SET qty_pesan     = 1000.0 / 48,
       harga_pesan   = 11554 * 48,
       satuan_ad_hoc = 'Roll'
 WHERE id = 'd798a7c8-fbb1-4cea-a690-fb1c3d8c0012'
   AND qty_pesan = 1000
   AND qty_terima IS NULL;

-- DOWN:
-- UPDATE public.purchase_order_item
--    SET qty_pesan = 1000, harga_pesan = 11554, satuan_ad_hoc = NULL
--  WHERE id = 'd798a7c8-fbb1-4cea-a690-fb1c3d8c0012';
