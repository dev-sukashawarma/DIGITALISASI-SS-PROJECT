-- 20260908170000_koreksi_harga_beku_surat_jalan_sejak_1sep.sql
--
-- Membersihkan harga beku (surat_jalan_item.harga_snapshot) untuk periode
-- sejak 1 September 2026, supaya tanggal itu bisa dipakai sebagai titik mulai
-- perhitungan HPP/valuasi yang sebanding.
--
-- HANYA 9 BARIS. Lihat "YANG SENGAJA TIDAK DISENTUH" di bawah -- bagian itu
-- lebih penting daripada bagian yang diperbaiki.
--
-- ============================================================================
-- 1. AYAM -- 6 baris, 1 September. Harga dari dokumen uji coba.
-- ============================================================================
-- bahan_baku_harga_history mencatat master AYAM sempat ditimpa
-- 51.000 -> 35.000 pada 28 Agustus oleh PO 'TEST/PO/PARTIAL/1787895628258',
-- lalu dikembalikan ke 53.500 pada 1 September oleh PO sungguhan
-- PO/KITCHEN/20260901/0001. Enam surat jalan tanggal 1 September terlanjur
-- membekukan 35.000.
--
-- Bukan tebakan: satuan AYAM adalah Kg dan tidak pernah berubah
-- (satuan_distribusi 'kg', faktor 1), jadi jumlahnya pasti Kg dan yang salah
-- memang harganya. Harga benar pada tanggal itu tercatat jelas: 53.500.

UPDATE public.surat_jalan_item sji
SET harga_snapshot = 53500
FROM public.surat_jalan sj, public.bahan_baku b
WHERE sj.id = sji.surat_jalan_id AND b.id = sji.bahan_baku_id
  AND b.nama = 'AYAM'
  AND sji.harga_snapshot = 35000
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

-- ============================================================================
-- 2. CUP (2 baris) & KERTAS STRUK (1 baris) -- harga per sub-satuan
-- ============================================================================
-- Keduanya membekukan harga per SUB-satuan sementara qty_dikirim disimpan
-- dalam satuan besar (SuratJalanForm menulis qty / getDistribusiFactor).
--   CUP           satuan Pack, distribusi pcs,  faktor 25 -> 1.780 x 25 = 44.500
--   KERTAS STRUK  satuan pack, distribusi roll, faktor 10 -> 1.600 x 10 = 16.000
-- Dikalikan faktornya, BUKAN diganti master hari ini, supaya tingkat harga
-- saat pengiriman tetap terjaga (itu memang guna pembekuan).
--
-- Aman karena satuan kedua bahan ini TIDAK PERNAH berubah, jadi qty-nya pasti
-- sudah pada basis yang sekarang -- hanya sisi harga yang tertinggal.

UPDATE public.surat_jalan_item sji
SET harga_snapshot = sji.harga_snapshot * 25
FROM public.surat_jalan sj, public.bahan_baku b
WHERE sj.id = sji.surat_jalan_id AND b.id = sji.bahan_baku_id
  AND b.nama = 'CUP' AND sji.harga_snapshot < 10000
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

UPDATE public.surat_jalan_item sji
SET harga_snapshot = sji.harga_snapshot * 10
FROM public.surat_jalan sj, public.bahan_baku b
WHERE sj.id = sji.surat_jalan_id AND b.id = sji.bahan_baku_id
  AND b.nama = 'KERTAS STRUK' AND sji.harga_snapshot < 10000
  AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= '2026-09-01';

-- ============================================================================
-- YANG SENGAJA TIDAK DISENTUH -- dan kenapa
-- ============================================================================
--
-- FOIL, 10 baris 3-8 September, harga beku 8.791,2 sementara master kini
-- 421.977,6 (rasio 48). TAMPAK salah satuan, TERNYATA BENAR. Saat surat jalan
-- itu dibuat, satuan FOIL masih Roll (baru berubah ke Dus oleh migration
-- 20260908103000), jadi qty_dikirim-nya JUGA dalam Roll. Pasangannya
-- konsisten: 48 Roll x 8.791,2 = 421.977,6 = tepat 1 Dus. Mengalikan harganya
-- 48x sementara qty tetap Roll akan menambah sekitar Rp83 juta nilai fiktif.
--
-- Sidik jarinya: qty bernilai 48 muncul empat kali -- persis faktor bahannya.
-- 48 Dus foil ke satu outlet dalam sehari itu mustahil.
--
-- PELAJARAN UMUM: memeriksa harga terhadap master TIDAK CUKUP. Untuk tiap
-- bahan yang satuannya pernah berubah, qty ikut berpindah basis, sehingga
-- pasangan (qty, harga) bisa tetap benar meski harga terlihat salah 48x.
-- Uji yang benar: apakah qty x harga menghasilkan rupiah yang masuk akal.
--
-- Karena itu, kelompok berikut juga TIDAK disentuh sampai sisi qty-nya
-- diperiksa satu per satu: MAYONAISE (14), SAOS TOMAT POUCH (7), KEJU (2),
-- PLASTIK MERAH (2), PAPER WRAP (10) -- keyakinan sedang/lemah; dan
-- SAOS CABE (7), SAOS SAMYANG (2) -- isi kemasannya belum terdaftar benar
-- di bahan_baku, jadi tak ada faktor sah untuk dipakai.
--
-- Juga tidak disentuh: 35 baris yang harganya beda tapi satuannya benar
-- (SAPI beku 100.000, FOIL lama 11.554, POLYBAG 9.000). Itu pembekuan yang
-- bekerja sebagaimana mestinya -- barang dikirim saat harganya memang segitu.
--
-- IDEMPOTEN: tiap UPDATE memakai syarat yang menjadi salah setelah dijalankan.
