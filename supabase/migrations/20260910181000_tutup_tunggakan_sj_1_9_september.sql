-- 20260910181000_tutup_tunggakan_sj_1_9_september.sql
-- Menutup 39 tunggakan surat jalan 1-9 September sebagai DOKUMEN saja.
-- Keputusan owner 2026-09-10: "tutup sebagai dokumen tanpa mengubah stok",
-- dieksekusi "sampe tanggal 9".
--
-- KENAPA STOK TIDAK DISENTUH
--   Barangnya sudah diterima outlet (dikonfirmasi owner) dan sudah lama
--   terserap opname harian, yang menyetel saldo ke hitungan fisik. Kalau
--   stoknya ditambahkan sekarang, saldo outlet naik ratusan juta di atas angka
--   yang sudah benar -- stok hantu.
--
--   Gudang Pusat sudah didebit saat SJ ditandai dikirim, dan debit itu memang
--   benar: barangnya nyata keluar. Jadi kedua sisi buku sebenarnya sudah betul.
--   Yang salah cuma dokumennya yang menggantung.
--
-- NOL BARIS LEDGER DITULIS. Ini murni UPDATE status + penanda.
--
-- KENAPA 'selesai', BUKAN 'dibatalkan'
--   'dibatalkan' salah secara fakta -- barangnya sampai. 'selesai' adalah status
--   akhir yang benar; penanda ditutup_administratif_at yang membedakannya dari
--   SJ yang melewati verifikasi sungguhan.
--
-- LINGKUP DIJAGA TIGA LAPIS: daftar id eksplisit + status = 'dikirim' +
-- penanda masih NULL. SJ baru tidak ikut tersapu, dan menjalankannya dua kali
-- tidak mengubah apa pun.
--
-- TIDAK TERMASUK:
--   - 10 September ke atas (masih wajar diverifikasi crew)
--   - seluruh Agustus (keputusan owner 2026-09-09, ditegaskan 2026-09-10)
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
  '25602df1-9106-4d23-853a-fb55c06c88b1', -- 2026-09-01 SUKA SHAWARMA SAWANGAN
  'b894bb8f-7488-48da-ba12-23414f6594c6', -- 2026-09-01 SUKA SHAWARMA BEJI
  'a84ec8bf-3ae5-4bc2-b671-1af4a609586d', -- 2026-09-01 SUKA SHAWARMA PAJAJARAN
  '7d0a78f0-204e-408e-8a3d-533b8a10adfc', -- 2026-09-01 SUKA SHAWARMA JAGAKARSA
  'f41e8ff0-8c5b-4509-9fab-afdf684d1b09', -- 2026-09-02 SUKA SHAWARMA BEJI
  '0928257a-051f-4c1c-a68c-dc5d86d0486e', -- 2026-09-02 SUKA SHAWARMA DEPOK SUKMAJAYA
  'b49c70dc-6a51-44c7-a568-a271e11e759a', -- 2026-09-02 MITRA CIBINONG
  '9c80e654-c620-4a48-a65f-8accf560eec8', -- 2026-09-02 MITRA SENTUL
  '99fbe287-f2fc-4af9-a311-5e7b8cb96250', -- 2026-09-02 MITRA CICURUG
  '5b40d61a-b4e4-49f5-a513-4c984edc91d3', -- 2026-09-02 MITRA PEKAYON
  'a30bfc1b-3c05-4ab6-a7b0-07ecb81d894d', -- 2026-09-02 SUKA SHAWARMA JATIWARINGIN
  '9b8ad9ba-f57b-425b-83fe-9fcba641d555', -- 2026-09-02 MITRA CIBINONG
  '47cedc73-843d-4468-82a9-93f2afef8161', -- 2026-09-03 SUKA SHAWARMA JAGAKARSA
  'e8dbc99b-9014-4c2f-9bf1-0aeabf8acc67', -- 2026-09-03 MITRA KALISARI
  '3fdb3589-42b6-4fe9-8ebc-621d8aebbec9', -- 2026-09-03 SUKA SHAWARMA JATIWARINGIN
  '11ae81f6-cfb1-4944-853d-e9ba14d6720f', -- 2026-09-03 MITRA PEKAYON
  'c31a8586-ce96-40d5-94c0-20298121bda2', -- 2026-09-04 SUKA SHAWARMA EMPANG
  '9e31e28a-6fe7-4af9-8e5c-6ecfb0ac4a1c', -- 2026-09-04 MITRA CILEUNGSI
  '9d808fb9-6656-49d6-9a55-0987ee287145', -- 2026-09-04 SUKA SHAWARMA CIRENDEU
  'e5a70867-f0ac-4e41-af09-9246ad693a13', -- 2026-09-04 SUKA SHAWARMA SAWANGAN
  '899344f4-0444-44e6-a7db-a214c881efdb', -- 2026-09-04 MITRA PALEDANG
  '685b4bdc-a1e9-4677-9e8f-674ccc8965b9', -- 2026-09-05 MITRA CIBINONG
  'c7e93f94-e40b-4de4-9395-9d2b56cbf343', -- 2026-09-05 SUKA SHAWARMA SAWANGAN
  '650068b5-5239-4149-8ddf-e6a1e2abf8f7', -- 2026-09-06 MITRA CIBUBUR
  '4fc870f9-13f7-4b1d-abeb-5501e7f31a34', -- 2026-09-07 SUKA SHAWARMA BEJI
  '699b7536-0d65-4185-a8b1-49b1eb5092cf', -- 2026-09-07 SUKA SHAWARMA DEPOK SUKMAJAYA
  '69ba8606-7caa-4b59-8502-beb4c216efd7', -- 2026-09-07 SUKA SHAWARMA JAGAKARSA
  'd2e5dfe3-8e7a-481b-81fb-fc4b92b29712', -- 2026-09-07 SUKA SHAWARMA JAGAKARSA
  'fa09e294-6f28-4a15-b36a-a9e88925359b', -- 2026-09-07 SUKA SHAWARMA JATIWARINGIN
  '6ddc7d76-53ac-4451-80f9-a7cc62bb4115', -- 2026-09-07 MITRA CIBINONG
  '8f488d2a-9d6d-47b5-ba2f-b43e2d2fae48', -- 2026-09-07 MITRA PALEDANG
  '2d73e414-bc1f-4f08-85ee-fce0101afe32', -- 2026-09-08 SUKA SHAWARMA SAWANGAN
  'cd1039c4-b132-4bd5-8e8c-4ae7e3f6a33a', -- 2026-09-08 SUKA SHAWARMA SAWANGAN
  '02d8dd0a-b8a7-411d-a643-90ae48bf7835', -- 2026-09-08 SUKA SHAWARMA DRAMAGA
  'caf40b9b-aa88-44aa-9c4a-43565fb294e4', -- 2026-09-08 SUKA SHAWARMA EMPANG
  '467d6f38-9fa8-47d5-9319-6adf9313bc9c', -- 2026-09-09 SUKA SHAWARMA JATIWARINGIN
  'bac740bf-1da2-4a83-ac25-798fe023f4a0', -- 2026-09-09 MITRA PEKAYON
  'c66938a8-5195-494b-8b48-882a767f499a', -- 2026-09-09 SUKA SHAWARMA BEJI
  'f0107f02-e3d1-4810-8fd3-54db30235318'  -- 2026-09-09 SUKA SHAWARMA DEPOK SUKMAJAYA
 )
   AND status = 'dikirim'
   AND ditutup_administratif_at IS NULL;

-- DOWN:
-- UPDATE public.surat_jalan
--    SET status = 'dikirim', ditutup_administratif_at = NULL
--  WHERE ditutup_administratif_at IS NOT NULL
--    AND (created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN DATE '2026-09-01' AND DATE '2026-09-09';
