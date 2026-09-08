-- 20260908103000_foil_satuan_dus.sql
--
-- FOIL mendapat tingkat satuan "Dus" di atas Roll, atas permintaan owner
-- (8 September 2026): crew menghitung FOIL per dus di rak, bukan per roll.
-- Isi 1 Dus dikonfirmasi = 48 Roll -- sesuai seluruh kiriman Gudang Pusat
-- terakhir (4 & 7 Sep: qty 48 roll = 36.480 cm) dan SKU lama "FOIL (48)"
-- yang digabung ke FOIL pada 3 September.
--
--                       sebelum        sesudah
--   satuan besar        Roll           Dus
--   satuan tengah       (tidak ada)    Roll   (faktor_tengah 48)
--   satuan kecil        cm             cm     (TIDAK berubah)
--   faktor_tampilan     760            36.480 (cm per satuan besar)
--   faktor_konversi     760            760    (cm per satuan TENGAH -- TETAP)
--
-- KENAPA AMAN
--
-- 1. Satuan terkecil tetap cm. Seluruh baris stok_balance dan seluruh riwayat
--    ledger_stok tetap valid apa adanya -- tidak ada saldo yang perlu
--    direkonsiliasi. Ini bedanya dengan POLYBAG (20300122000003), yang satuan
--    kecilnya ikut berubah (Lembar -> Pcs) sehingga saldonya harus di-opname
--    ulang.
--
-- 2. faktor_konversi TIDAK berubah. Konvensinya "satuan kecil per satuan
--    TENGAH" (bandingkan KEJU 10 Lembar/Pack, KENTANG 1000 Gram/Kg,
--    PLASTIK VACUM 100 Lembar/Pack). Resep BOM tetap 35-50 cm/porsi dan
--    potongan stok per order tidak bergeser sedikit pun.
--
-- 3. satuan_distribusi tetap 'roll' -- sekarang cocok dengan satuan_tengah,
--    jadi getDistribusiFactor() mengembalikan faktor_tengah (48), pola yang
--    sama dengan KEJU (dist 'pack' -> faktor_tengah 24). Permintaan bahan &
--    surat jalan tetap diisi dalam Roll seperti sekarang. Diverifikasi
--    sebelum migration ini: 0 permintaan FOIL berstatus terbuka, jadi tidak
--    ada baris qty_diminta yang berpindah arti di tengah jalan.
--
-- 4. Harga: basis kanonik = harga per satuan besar + kemasan_qty = faktor
--    penuh (satuan kecil per satuan besar). Keduanya dikali 48 bersamaan,
--    jadi harga per cm TIDAK berubah:
--        8.791,2 / 760 = 421.977,6 / 36.480 = Rp11,5674/cm
--    HPP, nilai persediaan, dan laporan laba tidak bergeser serupiah pun.
--
-- URUTAN MENGIKAT: faktor DULU, baru harga. sync_harga_beli_display()
-- menghitung angka tampilan dari faktor penuh; kalau harga diperbarui lebih
-- dulu ia memakai faktor 760 yang lama (pelajaran dari 20300122000003).
--
-- CATATAN: migration ini TIDAK memperbaiki saldo FOIL yang ter-nol di
-- beberapa outlet (Pajajaran, Cirendeu, Jagakarsa, Paledang, Cibinong) akibat
-- crew mengetik 0 saat opname 5-7 September. Koreksi itu pekerjaan terpisah
-- lewat ledger adjustment setelah hitung fisik, sesuai SOP.

-- 1. Faktor & satuan.
UPDATE public.bahan_baku
   SET satuan          = 'Dus',
       satuan_tengah   = 'Roll',
       faktor_tengah   = 48,
       satuan_kecil    = 'cm',
       faktor_tampilan = 36480,
       faktor_konversi = 760
 WHERE nama = 'FOIL'
   AND satuan = 'Roll'
   AND satuan_tengah IS NULL
   AND faktor_tampilan = 760;

-- 2. Harga (setelah faktor, lihat catatan di atas).
UPDATE public.bahan_baku_harga h
   SET harga_beli     = h.harga_beli * 48,
       kemasan_qty    = 36480,
       kemasan_satuan = 'cm'
  FROM public.bahan_baku b
 WHERE b.id = h.bahan_baku_id
   AND b.nama = 'FOIL'
   AND h.kemasan_qty = 760;

-- 3. Surat jalan yang MASIH BERJALAN (status dikirim/draft, belum diverifikasi).
--
--    qty_dikirim disimpan dalam SATUAN BESAR (SuratJalanForm mengonversi input
--    Roll -> basis lewat getDistribusiFactor sebelum insert), dan trigger
--    verifikasi/pengiriman mengalikannya dengan faktor_tampilan lewat
--    to_ledger_scale(). Baris yang dibuat SEBELUM migration ini menyimpan
--    "48" dengan arti 48 Roll; sesudah migration angka itu berarti 48 DUS.
--    Kalau dibiarkan, verifikasi kiriman lama akan menulis ledger 48x lipat.
--
--    Diperiksa saat migration ini disusun: 26 baris terdampak (termasuk 2 draft
--    yang dibuat pagi 8 Sep dan 3 kiriman 4-7 Sep yang belum diverifikasi).
--    PO FOIL terbuka: 0. Permintaan bahan FOIL terbuka: 0. Tabel mutasi antar
--    outlet tidak ada di database ini.
--
--    Daftar id ditulis eksplisit supaya statement ini idempoten -- pembagian
--    berulang tidak mungkin terjadi kalau file ini dijalankan dua kali.
UPDATE public.surat_jalan_item
   SET qty_dikirim = qty_dikirim / 48
 WHERE id IN (
  '2f122184-ec25-4582-8999-fcccbd865abe',
  '0571d4c1-a464-4914-9624-301e1f3ef94e',
  '301346c5-427b-4b2b-ba17-0f169a2947f6',
  '1252d62a-d401-4548-82a4-d089aeb58e3d',
  'ef4f8bf8-46ef-45c3-ab73-faa96c9cd08a',
  '1e633280-7577-4750-8e41-de4f3d9f1211',
  '60b5de00-3fdb-410b-a9ca-2da975ca0e14',
  '04daf45a-60be-4eb9-843a-72983e9b4757',
  'a352f2a1-c298-49bb-a020-c21e5311080d',
  '4f2ff227-102a-4e0c-9f6e-db491930bacb',
  '8226d183-556f-4113-81a9-d748a53530d8',
  'a1d30974-c36f-431b-8bd5-8d88cfdfec71',
  '740f11a7-e0cc-483b-80fc-9df250c42df5',
  'cee13511-17c8-4bdb-821c-52dd4b691660',
  'e5995299-bdbf-4b5b-8939-09a18fcf1a47',
  '8e46e56e-a304-4de9-9ae1-14d8373a01d9',
  'c8e9c8e4-65d1-4327-84e8-0aacaca6e5a8',
  '17511d73-fcea-4566-8fae-3bc52d5418c2',
  '013ed107-ceb1-4c77-8763-bdedbbd2943d',
  'caf86031-0c77-4a4f-9ed0-ed19f75004bb',
  '4a190b7b-e226-4d73-aa07-5fd57bf5cdb3',
  '700fd179-b6bc-41ad-ba99-129e32e628b7',
  'df42a318-d816-44e9-9bd8-63964ae7d803',
  'faf1a9e2-c007-4e7a-b03f-37ad2450bc2f',
  '3f899eee-535d-4017-ba11-1f63c3c9fc0a',
  'e658799d-4106-4ae6-bfcf-227366eccb99'
 );
