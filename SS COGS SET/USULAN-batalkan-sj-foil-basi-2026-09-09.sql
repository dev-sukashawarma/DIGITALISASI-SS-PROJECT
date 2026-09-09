-- USULAN-batalkan-sj-foil-basi-2026-09-09.sql
--
-- >>> INI USULAN, BUKAN MIGRATION <<<
-- File ini SENGAJA disimpan di luar supabase/migrations/ (folder "SS COGS SET")
-- justru supaya `supabase db push` siapa pun, untuk migration lain manapun,
-- TIDAK BISA menerapkannya secara tidak sengaja. Isinya masih persis draft
-- migration `20260909180000_batalkan_sj_foil_basi.sql` yang ditulis Task 4
-- (fix wave whole-branch review, cabang fix/waterfall-konversi-satuan) --
-- JANGAN dipindah kembali ke supabase/migrations/ sebelum owner menjawab.
-- Begitu owner MENYETUJUI, kembalikan nama file aslinya
-- `20260909180000_batalkan_sj_foil_basi.sql` dan pindahkan lagi ke
-- supabase/migrations/ sebelum di-apply.
--
-- >>> FILE INI MEM-BYPASS JALUR PEMBATALAN RESMI <<<
-- Suka Shawarma sudah punya RPC resmi untuk membatalkan surat_jalan:
-- `batalkan_surat_jalan_draft` (didefinisikan di
-- supabase/migrations/20260905140000_allow_cancel_draft_surat_jalan.sql).
-- RPC itu melakukan TIGA hal yang UPDATE mentah di bawah ini TIDAK lakukan:
--   1. Menolak membatalkan apa pun selain status 'draft' (`IF v_sj.status !=
--      'draft' THEN RETURN ... END IF`) -- padahal SELURUH 21 dokumen di
--      bawah berstatus 'dikirim', jadi RPC ini justru akan MENOLAK semuanya.
--   2. Ikut membatalkan `permintaan_bahan` yang terhubung ke surat_jalan itu
--      (status -> 'dibatalkan', catatan ditambahkan).
--   3. Mengembalikan (refund) debit `outlet_balance` bertipe MATERIAL_PURCHASE
--      yang tercatat di `outlet_balance_ledger` untuk permintaan_bahan itu --
--      menambah `current_balance` outlet dan mencatat baris TOP_UP pembalik.
-- UPDATE langsung ke `surat_jalan.status` di bawah TIDAK melakukan satu pun
-- dari ketiganya. Siapa pun yang menindaklanjuti usulan ini WAJIB memutuskan
-- apakah ketiga efek samping itu (khususnya #2 dan #3 -- kalau permintaan
-- yang mendasari 21 SJ ini pernah mendebit dompet outlet) juga diinginkan,
-- DI LUAR 160 baris `transfer_keluar` yang belum di-reversal yang sudah
-- ditandai di header di bawah.
--
-- >>> VERIFIKASI CONTROLLER ATAS BLOK DOWN <<<
-- Diverifikasi ulang oleh controller (fix wave, 2026-09-09): SELURUH 21
-- kiriman DI BAWAH SUDAH punya baris ledger_stok (160 baris transfer_keluar
-- di GUDANG PUSAT, lihat catatan asli di bawah). Karena itu, blok `-- DOWN:`
-- di file ini -- yang menyetel ulang status ke 'dikirim' -- AMAN dijalankan:
-- trigger `sj_on_dikirim_kurangi_kitchen` yang akan ikut terpicu (OLD.status
-- <> 'dikirim' AND NEW.status = 'dikirim') punya guard `v_sudah_ada`
-- (SELECT EXISTS ... WHERE ref_shipment_id = NEW.id AND outlet_id =
-- <GUDANG PUSAT> AND tipe = 'transfer_keluar') yang akan MENEMUKAN baris
-- yang sudah ada dan melewati (RAISE WARNING + RETURN NEW tanpa INSERT) --
-- jadi DOWN TIDAK akan mendebit Gudang Pusat dua kali. Ini properti
-- keamanan yang tidak jelas terlihat sekilas dari kode DOWN itu sendiri --
-- dicatat di sini secara eksplisit supaya siapa pun yang mempertimbangkan
-- DOWN tidak perlu menelusuri trigger-nya dulu untuk yakin aman.
--
-- 20260909180000_batalkan_sj_foil_basi.sql
-- Batalkan surat jalan FOIL Juli-Agustus yang tak akan pernah diverifikasi.
-- <BELUM DISETUJUI OWNER -- jangan diterapkan sebelum owner menjawab>. Daftar
-- id eksplisit: idempoten, dan SJ baru tidak ikut tersapu.
--
-- Kenapa sekarang: qty_dikirim tersimpan dalam satuan BESAR dan baru dikalikan
-- faktor_tampilan saat verifikasi. Pemecahan FOIL (rencana lanjutan, spec §6)
-- akan mengubah faktor itu, sehingga dokumen yang menggantung berpindah arti --
-- kelas kesalahan yang sama dengan insiden 8 September (lihat
-- 20260908103000_foil_satuan_dus.sql §3, yang menghadapi masalah serupa untuk
-- SJ yang MASIH dalam rentang tanggal wajar; SJ di migration ini sudah basi
-- sejak awal, jadi jalan keluarnya bukan konversi, tapi pembatalan).
--
-- Diperiksa saat migration ini disusun (2026-09-09), query Step 1 brief:
--   21 baris surat_jalan_item FOIL, status draft/dikirim, created_at < 1 Sep 2026.
--   Rentang: 21 Juli - 16 Agustus 2026. Qty 0,0009-0,08 Dus (~0,04-4 Roll).
--   SELURUH 21 baris berstatus 'dikirim' pada saat pemeriksaan -- NOL berstatus
--   'draft'. Blok DOWN di bawah karena itu hanya perlu satu grup restore.
--
-- TIDAK menyentuh SJ September (Cileungsi, Cirendeu, Cibinong, 2 draft 9 Sep):
-- itu barang yang kemungkinan sudah di outlet dan harus diverifikasi, bukan
-- dibatalkan.
--
-- >>> TEMUAN PENTING, MENYIMPANG DARI ASUMSI BRIEF TASK 4 <<<
-- Brief menyatakan "SJ draft/dikirim belum pernah mengkredit stok outlet,
-- jadi pembatalannya tidak menggeser saldo mana pun" dan mengharapkan HITUNGAN
-- REFERENSI LEDGER = 0. Pemeriksaan ground-truth SEBELUM migration ini ditulis
-- menunjukkan itu SALAH untuk sisi PENGIRIM:
--
--   SELECT COUNT(*) FROM public.ledger_stok WHERE ref_shipment_id IN (<21 id>);
--   => 160 baris, SEMUANYA tipe 'transfer_keluar', SEMUANYA outlet_id
--      'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90' (GUDANG PUSAT (HQ)).
--
-- Setiap surat_jalan di Suka Shawarma memuat BANYAK bahan sekaligus (FOIL
-- cuma salah satu baris), dan status 'dikirim' SUDAH menulis transfer_keluar
-- di Gudang Pusat untuk SEMUA bahan dalam kiriman itu pada saat dikirim --
-- bukan hanya saat destinasi memverifikasi penerimaan. Jadi Gudang Pusat
-- SUDAH terdebit untuk 21 kiriman ini (FOIL maupun bahan lain yang ikut
-- dalam paket yang sama), dan qty itu TIDAK PERNAH dikreditkan ke outlet
-- tujuan karena SJ tidak pernah diverifikasi.
--
-- Migration ini HANYA mengubah status dokumen (persis pola brief) dan
-- SENGAJA TIDAK menyentuh ledger_stok -- membalik 160 baris transfer_keluar
-- (atau bahan-bahan lain di paket yang sama) adalah keputusan terpisah yang
-- butuh sepengetahuan owner/gudang, bukan sesuatu yang aman diasumsikan di
-- sini. Efek pembatalan tanpa koreksi ledger: saldo Gudang Pusat untuk FOIL
-- (dan bahan lain yang ikut dalam 21 paket ini) TETAP tercatat berkurang
-- seolah terkirim, walau dokumennya sekarang 'dibatalkan' dan barangnya
-- (secara fisik, kemungkinan) tidak pernah keluar gudang. Verifikasi Step 4
-- pada brief ("nol baris ledger BARU") tetap valid -- migration ini memang
-- tidak menulis baris ledger baru -- tapi TIDAK berarti saldo tidak
-- terdampak; 160 baris LAMA sudah ada dan tetap berdiri.
--
-- Rekomendasi ke owner sebelum menyetujui: putuskan apakah 160 baris
-- transfer_keluar ini perlu direversal (ledger adjustment balik di Gudang
-- Pusat) sebagai bagian dari, atau segera sesudah, persetujuan pembatalan
-- ini -- di luar scope Task 4 (read-only investigation only).

UPDATE public.surat_jalan
   SET status = 'dibatalkan',
       notes  = COALESCE(NULLIF(notes, ''), '') || ' [Dibatalkan: SJ FOIL basi, 2026-09-09]',
       updated_at = NOW()
 WHERE id IN (
   'd77576de-3280-4889-9582-d6eecd5832a5', -- SUKA SHAWARMA DEPOK SUKMAJAYA, 2026-07-21, dikirim
   'e23f6edc-70aa-4806-bb05-c4d409228841', -- SUKA SHAWARMA EMPANG, 2026-07-27, dikirim
   '3a2c4635-6f04-4b8e-b399-0318b872f1c1', -- MITRA CICURUG, 2026-08-01, dikirim
   '7b80efda-a57c-4d3c-a027-bdd2aee09c64', -- SUKA SHAWARMA DEPOK SUKMAJAYA, 2026-08-02 (SJ/KITCHEN/20260802/0004), dikirim
   '23a25f44-6870-446a-a6dc-f817cecd6552', -- SUKA SHAWARMA JATIWARINGIN, 2026-08-02 (SJ/KITCHEN/20260802/0005), dikirim
   '2c5e0dd1-4365-4113-bada-a4d3586ecdcd', -- MITRA KALISARI, 2026-08-03, dikirim
   'b5d33cba-fb70-4b1d-99c8-77deb61597a6', -- SUKA SHAWARMA SAWANGAN, 2026-08-04, dikirim
   '1ee4b376-ab7b-421a-aa0b-1f0dd1b49966', -- SUKA SHAWARMA DEPOK SUKMAJAYA, 2026-08-05, dikirim
   'f2b4deab-5f59-4b5d-a3fa-9bd8864faa0c', -- SUKA SHAWARMA SAWANGAN, 2026-08-06, dikirim
   '5fa3b744-5f0f-4c54-baa9-0baa1f69e24d', -- SUKA SHAWARMA JAGAKARSA, 2026-08-06 (SJ/KITCHEN/20260806/0005), dikirim
   'fdb5cea2-8e1e-4433-82b7-f8e7d76aa290', -- SUKA SHAWARMA BEJI, 2026-08-08, dikirim
   'd8dcdf98-ed3b-4237-9637-42743bc5cf91', -- SUKA SHAWARMA DEPOK SUKMAJAYA, 2026-08-08, dikirim
   '9f4e77bf-9a75-4741-9cc0-f41b39180eaa', -- MITRA SENTUL, 2026-08-08 (SJ/KITCHEN/20260808/0010), dikirim
   'b45af6aa-cc29-47fe-9066-65d4ae46f2b4', -- MITRA CIBINONG, 2026-08-09, dikirim
   'ce18e16e-9bb8-40b4-857e-def9fad824cd', -- SUKA SHAWARMA JATIWARINGIN, 2026-08-09, dikirim
   '7eb93708-a4d8-402d-94f6-bcbb0f36bbf7', -- MITRA PEKAYON, 2026-08-11, dikirim
   '1e696573-7967-44e4-b115-7ce83d643d03', -- SUKA SHAWARMA BEJI, 2026-08-12 (SJ/KITCHEN/20260812/0004), dikirim
   '1c2025b0-2467-41b6-b98a-dffa0460256f', -- MITRA SENTUL, 2026-08-13 (SJ/KITCHEN/20260813/0005), dikirim
   '768da9d9-670f-4f21-8dfc-0737450d58fa', -- MITRA CIBINONG, 2026-08-13 (SJ/KITCHEN/20260813/0007), dikirim
   '320aa879-2024-40dc-a64b-29021684fa2e', -- SUKA SHAWARMA JATIWARINGIN, 2026-08-16, dikirim
   'ccb2565d-a45b-456a-ae31-f5e9eaa14b10'  -- SUKA SHAWARMA BEJI, 2026-08-16, dikirim
 )
   AND status IN ('draft', 'dikirim');

-- DOWN:
-- Seluruh 21 baris di atas berstatus 'dikirim' pada saat migration ini
-- disusun (nol 'draft') -- karena itu satu UPDATE saja sudah memulihkan
-- semuanya dengan benar. Kalau di masa depan ternyata ada baris yang perlu
-- dipulihkan ke 'draft', JANGAN pakai statement di bawah untuk baris itu.
--
-- UPDATE public.surat_jalan
--    SET status = 'dikirim'
--  WHERE id IN (
--    'd77576de-3280-4889-9582-d6eecd5832a5',
--    'e23f6edc-70aa-4806-bb05-c4d409228841',
--    '3a2c4635-6f04-4b8e-b399-0318b872f1c1',
--    '7b80efda-a57c-4d3c-a027-bdd2aee09c64',
--    '23a25f44-6870-446a-a6dc-f817cecd6552',
--    '2c5e0dd1-4365-4113-bada-a4d3586ecdcd',
--    'b5d33cba-fb70-4b1d-99c8-77deb61597a6',
--    '1ee4b376-ab7b-421a-aa0b-1f0dd1b49966',
--    'f2b4deab-5f59-4b5d-a3fa-9bd8864faa0c',
--    '5fa3b744-5f0f-4c54-baa9-0baa1f69e24d',
--    'fdb5cea2-8e1e-4433-82b7-f8e7d76aa290',
--    'd8dcdf98-ed3b-4237-9637-42743bc5cf91',
--    '9f4e77bf-9a75-4741-9cc0-f41b39180eaa',
--    'b45af6aa-cc29-47fe-9066-65d4ae46f2b4',
--    'ce18e16e-9bb8-40b4-857e-def9fad824cd',
--    '7eb93708-a4d8-402d-94f6-bcbb0f36bbf7',
--    '1e696573-7967-44e4-b115-7ce83d643d03',
--    '1c2025b0-2467-41b6-b98a-dffa0460256f',
--    '768da9d9-670f-4f21-8dfc-0737450d58fa',
--    '320aa879-2024-40dc-a64b-29021684fa2e',
--    'ccb2565d-a45b-456a-ae31-f5e9eaa14b10'
--  )
--    AND status = 'dibatalkan';
-- (Ini TIDAK memulihkan 160 baris ledger_stok transfer_keluar yang sudah ada
-- sebelum migration ini -- lihat catatan besar di atas. DOWN ini hanya
-- memulihkan status dokumen, sama seperti UP hanya mengubah status dokumen.)
