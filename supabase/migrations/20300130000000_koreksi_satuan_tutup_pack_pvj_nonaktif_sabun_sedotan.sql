-- 20300130000000_koreksi_satuan_tutup_pack_pvj_nonaktif_sabun_sedotan.sql
--
-- SUDAH DIJALANKAN di produksi 4 September 2026 lewat SQL Editor.
-- Dicatat di sini supaya ada jejaknya -- kalau database dibangun ulang dari
-- migration, perubahan ini ikut. Semua pernyataan idempoten.
--
-- ============================================================================
-- LATAR
-- ============================================================================
--
-- Pemeriksaan seluruh harga di form permintaan bahan baku (4 September)
-- menemukan empat bahan bermasalah dari 54 bahan aktif. Perhitungan form-nya
-- sendiri SEHAT: qty dalam satuan besar dikali harga per satuan besar, tanpa
-- pembagian yang keliru. Yang bermasalah data masternya.
--
-- 1. TUTUP PACK -- punya harga (Rp89.000/Pack) tapi kemasan_qty KOSONG, dan
--    faktor_tampilan-nya 50 padahal owner mengonfirmasi 1 Pack = 25 Pcs.
--    Form permintaan tidak terganggu (89.000 x qty tetap benar), tapi HPP dan
--    Nilai Persediaan tak bisa menghitungnya.
--
-- 2. PLASTIK VACUUM JUMBO -- satuannya melingkar: satuan 'Roll' dengan
--    kemasan_qty 24 bersatuan 'Roll' juga ("1 Roll berisi 24 Roll").
--    Harganya benar (dibeli 3 Sep dari sultanpacking, 40 Roll @ Rp40.346),
--    tapi jalur HPP membaginya dengan 24 sehingga jadi Rp1.681/Roll.
--    Owner mengonfirmasi: dijual per Roll utuh, tanpa satuan lebih kecil.
--
-- 3-4. SABUN & SEDOTAN -- TIDAK punya harga sama sekali dan belum pernah
--    dibeli lewat PO, padahal sudah 5 dan 10 kali diminta outlet. Di form
--    permintaan keduanya bernilai Rp0, jadi lolos dari perhitungan anggaran.
--
-- Keputusan owner: SABUN & SEDOTAN dihentikan pemakaiannya.
--
-- ============================================================================
-- KENAPA DINONAKTIFKAN, BUKAN DIHAPUS
-- ============================================================================
--
-- Permintaan awal owner adalah "hapus dari database". Tidak dilakukan, karena
-- jejaknya besar dan FK-nya ON DELETE RESTRICT -- perintah hapus akan gagal,
-- dan kalaupun dipaksa akan menghancurkan jejak audit:
--
--            ledger  opname_item  permintaan  stok_balance  sisa saldo
--   SABUN       254          472           5            25       4.694
--   SEDOTAN      49          428          10            25         290
--
-- Mengikuti pola yang sudah dipakai proyek ini: MINYAK (NONAKTIF) di
-- 20260813120000, PLASTIK BENING di 20260813121500, FOIL (48) pada 3 September.
-- Efek bagi pengguna sama -- hilang dari semua daftar pilihan, tak bisa diminta
-- lagi -- tapi riwayatnya utuh.
--
-- CATATAN: stok fisiknya TIDAK dinolkan (SABUN 4.694, SEDOTAN 290). Kalau
-- barangnya memang masih ada di outlet, itu benar. Kalau ingin dinolkan,
-- lakukan lewat ledger adjustment terpisah, jangan UPDATE stok_balance.
--
-- ============================================================================
-- AMAN DILAKUKAN KARENA
-- ============================================================================
--
-- TUTUP PACK dan PLASTIK VACUUM JUMBO sama-sama dipakai di NOL resep aktif,
-- jadi mengubah faktornya tidak menggeser satu angka HPP pun. Diverifikasi
-- sebelum dijalankan.
--
-- TUTUP PACK: 17 baris bersaldo, semuanya sudah berskala satuan kecil, total
-- 2.696 Pcs. Nilainya naik dua kali lipat (Rp4,8 jt -> Rp9,6 jt) karena isi
-- kemasan dari 50 jadi 25 -- itu konsekuensi angka yang benar, bukan kenaikan.
--
-- ============================================================================
-- HASIL
-- ============================================================================
--
-- Setelah keempatnya diterapkan, kategori "belum bisa dinilai" di
-- nilai_persediaan_spv HABIS: 32 baris -> 0. Seluruh bahan aktif kini bisa
-- dinilai.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TUTUP PACK: 1 Pack = 25 Pcs
-- ----------------------------------------------------------------------------

UPDATE public.bahan_baku
SET faktor_tampilan = 25,
    faktor_konversi = 25
WHERE nama = 'TUTUP PACK'
  AND (faktor_tampilan IS DISTINCT FROM 25 OR faktor_konversi IS DISTINCT FROM 25);

UPDATE public.bahan_baku_harga h
SET kemasan_qty    = 25,
    kemasan_satuan = 'Pcs'
FROM public.bahan_baku b
WHERE b.id = h.bahan_baku_id
  AND b.nama = 'TUTUP PACK'
  AND (h.kemasan_qty IS DISTINCT FROM 25 OR h.kemasan_satuan IS DISTINCT FROM 'Pcs');

-- ----------------------------------------------------------------------------
-- 2. PLASTIK VACUUM JUMBO: dijual per Roll utuh, tanpa satuan lebih kecil
-- ----------------------------------------------------------------------------

UPDATE public.bahan_baku
SET faktor_konversi = 1,
    faktor_tampilan = NULL,
    satuan_kecil    = NULL
WHERE nama = 'PLASTIK VACUUM JUMBO'
  AND faktor_konversi IS DISTINCT FROM 1;

UPDATE public.bahan_baku_harga h
SET kemasan_qty    = 1,
    kemasan_satuan = 'Roll'
FROM public.bahan_baku b
WHERE b.id = h.bahan_baku_id
  AND b.nama = 'PLASTIK VACUUM JUMBO'
  AND h.kemasan_qty IS DISTINCT FROM 1;

-- ----------------------------------------------------------------------------
-- 3. SABUN & SEDOTAN: dinonaktifkan, BUKAN dihapus
-- ----------------------------------------------------------------------------

UPDATE public.bahan_baku
SET nama      = nama || ' (NONAKTIF)',
    is_active = false
WHERE nama IN ('SABUN', 'SEDOTAN')
  AND is_active;

-- ============================================================================
-- VERIFIKASI
-- ============================================================================
--
--   SELECT b.nama, b.is_active, b.satuan, b.satuan_kecil, b.faktor_tampilan,
--          h.kemasan_qty, h.kemasan_satuan, round(h.harga_beli) AS harga,
--          round(h.harga_beli / NULLIF(h.kemasan_qty,0), 2) AS per_satuan_kecil
--   FROM bahan_baku b LEFT JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
--   WHERE b.nama ILIKE 'TUTUP PACK%' OR b.nama ILIKE 'PLASTIK VACUUM JUMBO%'
--      OR b.nama ILIKE 'SABUN%' OR b.nama ILIKE 'SEDOTAN%';
--
-- Hasil yang diharapkan (terverifikasi 4 September):
--   TUTUP PACK            aktif   Pack/Pcs   25   Rp89.000  -> Rp3.560/Pcs
--   PLASTIK VACUUM JUMBO  aktif   Roll/-      1   Rp40.346  -> Rp40.346/Roll
--   SABUN (NONAKTIF)      nonaktif
--   SEDOTAN (NONAKTIF)    nonaktif
--
-- Dan tidak ada lagi bahan aktif yang belum bisa dinilai:
--
--   SELECT count(*) FROM stok_balance sb
--   JOIN bahan_baku b ON b.id = sb.bahan_baku_id
--   LEFT JOIN bahan_baku_harga h ON h.bahan_baku_id = sb.bahan_baku_id
--   WHERE b.is_active AND sb.saldo <> 0
--     AND (h.harga_beli IS NULL OR h.harga_beli = 0
--          OR h.kemasan_qty IS NULL OR h.kemasan_qty = 0);
--   -- harus 0
-- ============================================================================
