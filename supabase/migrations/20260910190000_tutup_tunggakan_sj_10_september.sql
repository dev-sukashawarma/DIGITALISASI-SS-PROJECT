-- 20260910190000_tutup_tunggakan_sj_10_september.sql
-- Menutup tunggakan surat jalan 10 September sebagai DOKUMEN saja.
-- Lanjutan langsung dari 20260910181000 (yang menutup 39 SJ tanggal 1-9 Sep);
-- polanya sama persis, hanya daftar id yang berbeda.
--
-- KENAPA TANGGAL 10 PERLU MIGRATION SENDIRI
--   Auto-verifikasi (20260910183000) berlaku forward-only mulai 11 September.
--   SJ tanggal 10 jatuh di celah: terlalu baru untuk ikut batch 1-9 Sep yang
--   dijalankan siang tadi, terlalu lama untuk disentuh cron. Tanpa migration ini
--   mereka menggantung selamanya.
--
-- KENAPA STOK TIDAK DISENTUH
--   Alasan identik dengan 20260910181000: barangnya sudah diterima outlet, dan
--   outlet-outlet ini melakukan opname tiap malam, yang menyetel saldo ke
--   hitungan fisik. Menambahkan stoknya sekarang = stok hantu di atas saldo yang
--   sudah benar. Gudang Pusat sudah didebit saat SJ ditandai dikirim, dan debit
--   itu memang benar -- barangnya nyata keluar. Yang salah cuma dokumennya.
--
-- NOL BARIS LEDGER DITULIS. Ini murni UPDATE status + penanda.
--
-- ⚠️ JALANKAN SETELAH OPNAME MALAM 10 SEPTEMBER, BUKAN SEBELUMNYA.
--   Ke-12 SJ ini dikirim antara 15:53 dan 17:13 WIB tanggal 10. Kalau ditutup
--   sore itu juga, outlet kehilangan kesempatan memverifikasi -- padahal
--   verifikasi sungguhan JAUH lebih baik daripada penutupan administratif
--   (stoknya benar-benar tercatat masuk, bukan sekadar diserap opname).
--   Premis "sudah terserap opname" baru benar setelah opname malamnya jalan.
--
-- LINGKUP DIJAGA TIGA LAPIS: daftar id eksplisit + status = 'dikirim' +
-- penanda masih NULL. SJ yang keburu diverifikasi crew tidak ikut tersapu, dan
-- menjalankannya dua kali tidak mengubah apa pun.
--
-- Spec: docs/superpowers/specs/2026-09-10-auto-verifikasi-surat-jalan-design.md

UPDATE public.surat_jalan
   SET status = 'selesai',
       ditutup_administratif_at = now(),
       notes = COALESCE(NULLIF(notes, ''), '')
               || '[Ditutup administratif 2026-09-10: barang sudah diterima, '
               || 'stok sudah tercermin lewat opname, nol baris ledger ditulis]',
       updated_at = now()
 WHERE id IN (
  'af7bca09-1040-4b19-b358-b1feed455088', -- 15:53 SUKA SHAWARMA JAGAKARSA
  '3ed5af13-13c6-4941-a955-3c973d50ce18', -- 15:56 SUKA SHAWARMA JAGAKARSA
  '4e308eef-2a39-4349-85cf-376569060440', -- 16:01 MITRA CILEUNGSI
  '8f448d39-05c3-4163-b07a-a8fcd4ca9b42', -- 16:04 SUKA SHAWARMA CIRENDEU
  '0cef0d37-8740-4ef1-948a-e371731dcb92', -- 16:06 SUKA SHAWARMA CIRENDEU
  '8dca3ce0-b6d1-4c22-91be-97d4e8a7787c', -- 16:18 SUKA SHAWARMA BEJI
  'abded1f2-4f5c-4ac6-8ff6-b5facd7866ff', -- 16:20 MITRA PEKAYON
  '646c45b4-81de-4eb2-b878-033a10b1719e', -- 16:56 MITRA CICURUG
  '4e4228ff-9510-4a99-b482-161ca4f66260', -- 17:03 SUKA SHAWARMA JATIWARINGIN
  '34555934-cfaf-45f2-b4e7-625339d3d0e8', -- 17:10 SUKA SHAWARMA JATIWARINGIN
  '45693c26-557f-4ec7-bcf3-f9c906cbd3f1', -- 17:13 MITRA KALISARI
  '1806b4c0-cd87-44c4-b50a-489d7e0ac242'  -- 17:13 SUKA SHAWARMA DRAMAGA
 )
   AND status = 'dikirim'
   AND ditutup_administratif_at IS NULL;

-- DOWN:
-- UPDATE public.surat_jalan
--    SET status = 'dikirim', ditutup_administratif_at = NULL
--  WHERE ditutup_administratif_at IS NOT NULL
--    AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = DATE '2026-09-10';
