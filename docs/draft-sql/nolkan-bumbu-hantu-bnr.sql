-- nolkan-bumbu-hantu-bnr.sql
--
-- ############################################################################
-- ##  JANGAN DIJALANKAN. PENDEKATANNYA SALAH.                               ##
-- ##  Disimpan sebagai catatan analisis, bukan sebagai naskah siap pakai.    ##
-- ############################################################################
--
-- Ditulis 5 September 2026 dengan premis "ketujuh bumbu tidak pernah ada
-- wujudnya di BNR". Premis itu DIBANTAH beberapa menit kemudian oleh data:
--
--   Opname BNR 9 Juni 2026 (finalized)
--     CENGKEH   qty_fisik 4   qty_system 0   selisih +4
--
--   Crew BNR PERNAH menghitung cengkeh secara fisik dan menemukan 4 buah.
--   Barangnya nyata. Yang salah bukan keberadaannya, melainkan JUMLAHNYA --
--   sistem bilang 32, hitungan orang bilang 4.
--
-- Menolkan lewat SQL akan menghapus barang yang benar-benar ada di rak.
--
-- ============================================================================
-- AKAR MASALAH YANG SEBENARNYA
-- ============================================================================
--
-- Ketujuh bumbu tidak pernah muncul di form opname outlet. Bukan karena
-- kategorinya -- MERICA (juga BUMBU) muncul normal di opname 4 September.
-- Penyebabnya daftar nama yang dipatok di kode:
--
--   packages/design-system/src/utils/bahanBaku.ts
--     gudangPusatItems = ['GARAM','JINTEN','KAYU MANIS','KETUMBAR','KUNYIT',
--                         'SASA','CENGKEH']
--   apps/stok/src/components/stok/OpnameForm.tsx:221
--     if (source === 'GUDANG_PUSAT' && !isGudang) return false
--
-- Crew BNR TIDAK PERNAH BISA mengoreksinya walaupun mau. Angka salah itu
-- terkunci di luar jangkauan satu-satunya orang yang bisa melihat raknya.
-- (Cengkeh 9 Juni lolos karena opname saat itu belum kena penyaring ini.)
--
-- ============================================================================
-- PERBAIKAN YANG BENAR (bukan SQL)
-- ============================================================================
--
-- Tampilkan bahan ber-source GUDANG_PUSAT di form opname outlet HANYA bila
-- outlet itu punya saldo <> 0 untuk bahan tersebut. Lalu biarkan opname fisik
-- yang menentukan angkanya.
--
--   BNR              -> melihat ketujuhnya, bisa menghitung, terkoreksi normal
--   18 outlet lain   -> tak ada perubahan (saldo nol, tidak muncul)
--   setelah nol      -> hilang sendiri dari form
--   Gudang Pusat     -> tidak tersentuh
--
-- Ini menutup SEBABNYA, bukan cuma gejalanya: menolkan lewat SQL tidak
-- mencegah angka salah muncul lagi, dan crew tetap tidak berdaya.
--
-- ============================================================================
-- ISI LAMA (arsip -- jangan dipakai)
-- ============================================================================
--
-- ============================================================================
-- APA INI
-- ============================================================================
--
-- SUKA SHAWARMA BNR memegang 7 bahan kategori BUMBU yang sebenarnya hanya milik
-- Gudang Pusat: JINTEN, KAYU MANIS, GARAM, CENGKEH, KETUMBAR, SASA, KUNYIT.
--
-- Dibaca oleh halaman Nilai Persediaan sebagai Rp74.954.720 -- aset yang tidak
-- pernah ada wujudnya.
--
-- ============================================================================
-- BUKTI BAHWA INI BUKAN STOK NYATA
-- ============================================================================
--
-- 1. Riwayat ledger ketujuhnya HANYA 3 baris, semua tipe 'adjustment', dengan
--    timestamp identik di ketujuh bahan -- tulisan skrip, bukan transaksi.
--      11 Jun  +6   "Seed awal - AMAN"
--      12 Jun  +6   "Seed awal - AMAN"
--       8 Jul  dipangkas dari saldo_sebelum 9999 -> 32/35
--
-- 2. NOL baris tipe 'pemakaian' sepanjang riwayat. Tidak pernah dipakai resep
--    apa pun di BNR.
--
-- 3. Tidak pernah di-opname -- form opname outlet menyembunyikan bahan
--    ber-source GUDANG_PUSAT (packages/design-system/src/utils/bahanBaku.ts),
--    sehingga crew BNR tidak pernah bisa mengoreksinya sendiri.
--
-- 4. Hanya ada di 2 lokasi: BNR dan GUDANG PUSAT (HQ). Gudang Pusat wajar.
--
-- 5. Besarannya mustahil secara fisik: 32 Karung ketumbar, 35 Dus SASA di satu
--    gerai shawarma.
--
-- ============================================================================
-- YANG PERLU DIKONFIRMASI OWNER SEBELUM DIJALANKAN
-- ============================================================================
--
-- "Apakah benar BNR tidak menyimpan ketujuh bumbu ini secara fisik?"
--
-- Kalau ternyata BNR memang menyimpan sebagian, JANGAN jalankan naskah ini.
-- Yang benar adalah opname fisik, bukan penolan massal.
--
-- ============================================================================
-- SIFAT NASKAH
-- ============================================================================
--
-- * Lewat ledger 'adjustment', BUKAN UPDATE stok_balance -- SOP proyek ini.
--   Trigger ledger_stamp_saldo yang mengurus saldonya.
-- * IDEMPOTEN: delta dihitung sebagai (0 - saldo saat ini), bukan angka mati.
--   Dijalankan dua kali, yang kedua menulis nol baris.
-- * Skala satuan tidak jadi soal: menolkan berlaku di skala apa pun.
-- * Tidak menghapus baris stok_balance dan tidak menonaktifkan bahannya --
--   jejak audit tetap utuh, dan bahan tetap hidup di Gudang Pusat.
--
-- ============================================================================

-- LANGKAH 1 -- lihat dulu apa yang akan diubah (jalankan sendiri, aman)
SELECT b.nama,
       sb.saldo                    AS saldo_sekarang,
       b.satuan,
       (0 - sb.saldo)              AS delta_yang_akan_ditulis
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.outlet_id = '550e8400-e29b-41d4-a716-446655440001'::uuid
  AND b.nama IN ('JINTEN','KAYU MANIS','GARAM','CENGKEH','KETUMBAR','SASA','KUNYIT')
  AND sb.saldo <> 0
ORDER BY b.nama;

-- LANGKAH 2 -- koreksi (jalankan setelah LANGKAH 1 diperiksa & owner setuju)
INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
SELECT sb.outlet_id,
       sb.bahan_baku_id,
       'adjustment',
       (0 - sb.saldo),
       'Koreksi 2026-09-05: bumbu Gudang Pusat yang tidak pernah ada wujudnya '
         || 'di BNR. Asal saldo = seed awal + reset baseline, nol pemakaian '
         || 'sepanjang riwayat. Disetujui owner.',
       NOW()
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.outlet_id = '550e8400-e29b-41d4-a716-446655440001'::uuid
  AND b.nama IN ('JINTEN','KAYU MANIS','GARAM','CENGKEH','KETUMBAR','SASA','KUNYIT')
  AND sb.saldo <> 0;

-- LANGKAH 3 -- verifikasi (harus mengembalikan 0 baris)
SELECT b.nama, sb.saldo
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.outlet_id = '550e8400-e29b-41d4-a716-446655440001'::uuid
  AND b.nama IN ('JINTEN','KAYU MANIS','GARAM','CENGKEH','KETUMBAR','SASA','KUNYIT')
  AND sb.saldo <> 0;

-- LANGKAH 4 -- verifikasi nilai persediaan (baris BNR harus hilang dari sini)
SELECT outlet, count(*) AS baris, round(sum(nilai)) AS nilai
FROM nilai_persediaan_spv
WHERE status = 'skala_belum_pasti'
GROUP BY outlet
ORDER BY 3 DESC;

-- ============================================================================
-- CATATAN LANJUTAN (di luar naskah ini)
-- ============================================================================
--
-- Menolkan saldo TIDAK mencegah hal ini terulang. Selama BNR masih punya baris
-- stok_balance untuk ketujuh bumbu ini, skrip seed/baseline berikutnya bisa
-- mengisinya lagi -- dan crew BNR tetap tidak bisa mengoreksinya sendiri karena
-- form opname menyembunyikan bahan ber-source GUDANG_PUSAT.
--
-- Pencegahan yang sebenarnya perlu dibahas terpisah.
