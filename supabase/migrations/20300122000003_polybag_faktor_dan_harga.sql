-- 20300122000003_polybag_faktor_dan_harga.sql
--
-- POLYBAG -- satu-satunya bahan yang ditahan dari normalisasi 20300122000001,
-- karena catatan owner "1 bal = 25 pak" bertentangan dengan faktor tersimpan.
--
-- Dikonfirmasi owner 3 September 2026: satuan POLYBAG HANYA Pack dan Pcs.
-- Tingkat "Ikat" yang tersimpan sebagai satuan besar TIDAK ADA di lapangan --
-- itu tingkat karangan yang tidak pernah dipakai. Rantai yang benar dua tingkat:
--
--                        tersimpan              benar
--   satuan besar         Ikat                   Pack
--   satuan tengah        Pack (faktor 5)        (tidak ada)
--   satuan kecil         Lembar (faktor 5)      Pcs (faktor 9)
--   faktor penuh         25                     9
--
-- Harga: Rp25.000 per Pack (jawaban konfirmasi), jadi harga_beli = 25.000
-- dengan kemasan_qty = 9.
--
-- Perubahan ini juga MENJELASKAN pola yang bikin saya ragu sebelumnya: saldo per
-- outlet (105, 98, 58, 30, 28, 25, 18, ...) dan pergerakan nyata (kirim -10,
-- terima +10, terima +5) semuanya bilangan bulat kecil yang tidak menyerupai
-- Ikat maupun Pcs. Ternyata memang hitungan PAK -- satuan operasional yang
-- sebenarnya. Master data-lah yang selama ini tidak cocok dengan lapangan.
--
-- ⚠ SALDO STOK TIDAK DIREKONSILIASI DI SINI.
--   faktor_tampilan dipakai to_ledger_scale(); mengubahnya 25 -> 9 mengubah
--   konversi untuk penulisan ledger berikutnya di 21 dari 25 outlet yang
--   bertanda gram-scale, sementara 535 baris ledger lama ditulis dengan faktor
--   lama. Karena satuan besarnya sekaligus berubah (Ikat -> Pack), arti angka
--   historis tidak bisa dipetakan ulang lewat SQL secara aman.
--
--   Keputusan owner: perbaiki master data sekarang -- faktor yang salah tidak
--   menjadi lebih aman kalau dibiarkan -- lalu tetapkan ulang saldo lewat OPNAME
--   FISIK sebagai pekerjaan terpisah.
--
--   Risiko tertahan karena POLYBAG TIDAK dipakai resep mana pun: HPP dan laporan
--   laba tidak tersentuh. Yang dipertaruhkan hanya akurasi stok, dan stok
--   POLYBAG memang sudah tidak akurat sebelum migration ini.
--
-- CATATAN PO: SPB/PO/VII/2026/039 (24 Agt) mencatat harga Rp600.000 dengan qty 2
-- pada satuan "Ikat" yang kini dihapus. Kalau itu berarti 2 bal @ 25 pak, harga
-- per pak-nya Rp24.000 -- dekat dengan Rp25.000 yang dikonfirmasi. Catatan PO
-- tersebut perlu ditinjau purchasing secara terpisah; migration ini tidak
-- menyentuh data PO.
--
-- Urutan mengikat: faktor DULU, baru harga. sync_harga_beli_display() menghitung
-- angka tampilan dari faktor penuh, jadi kalau harga diperbarui lebih dulu ia
-- akan memakai faktor 25 yang salah.

UPDATE public.bahan_baku
   SET satuan          = 'Pack',
       satuan_tengah   = NULL,
       faktor_tengah   = NULL,
       satuan_kecil    = 'Pcs',
       faktor_konversi = 9,
       faktor_tampilan = 9
 WHERE nama = 'POLYBAG'
   AND faktor_tengah = 5
   AND faktor_konversi = 5;

UPDATE public.bahan_baku_harga h
   SET harga_beli = 25000,
       kemasan_qty = 9,
       kemasan_satuan = 'Pcs'
  FROM public.bahan_baku b
 WHERE b.id = h.bahan_baku_id
   AND b.nama = 'POLYBAG'
   AND h.harga_beli = 9000;

-- Setelah ini seluruh 51 bahan yang dikonfirmasi memakai basis kanonik yang sama:
--   harga_beli  = harga per satuan besar
--   kemasan_qty = faktor penuh (satuan kecil per satuan besar)
-- Sisa yang belum dinormalkan: PLASTIK BESAR, SABUN, SEDOTAN, TUTUP PACK
-- (belum dijawab, tidak dipakai resep).
