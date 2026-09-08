-- 20300131000000_nilai_persediaan_kecualikan_lokasi_non_operasional.sql
--
-- Mengecualikan lokasi non-operasional dari view nilai_persediaan_spv
-- (dibuat di 20300129000000).
--
-- ============================================================================
-- MASALAH
-- ============================================================================
--
-- View versi pertama memasukkan SEMUA lokasi yang punya baris stok. Diperiksa
-- 8 September 2026, akibatnya halaman Nilai Persediaan menampilkan:
--
--   pasti              725 baris   Rp   361 juta
--   skala_belum_pasti   47 baris   Rp 2.449 juta   <-- omong kosong
--
-- Dari Rp2.449 juta itu, **Rp2.374 juta berasal dari "outlet tes"** -- outlet
-- yang dipakai developer untuk uji coba, isinya angka karangan (termasuk sisa
-- "reset ke 10x reorder point" dan bekas uji bug skala opname).
--
-- Angka jujurnya, setelah lokasi non-operasional dikeluarkan:
--
--   OPERASIONAL  pasti              723 baris   Rp 358,8 juta
--   OPERASIONAL  skala_belum_pasti    8 baris   Rp  75,0 juta
--
-- ============================================================================
-- ATURAN (keputusan owner, 8 September 2026)
-- ============================================================================
--
--   "outlet tes hanya untuk testing oleh developer, jadi jangan masuk ke
--    perhitungan"
--
-- Berlaku untuk SEMUA perhitungan, bukan cuma view ini. Lihat catatan di
-- docs/CATATAN-LANJUTAN-HARGA-STOK.md -- outlet tes juga masih bocor ke
-- laporan lain (17 order / Rp880.000 omzet, 2 laporan waste) yang belum
-- ditutup dan perlu digarap terpisah.
--
-- ============================================================================
-- YANG DIKECUALIKAN, DAN KENAPA HANYA INI
-- ============================================================================
--
--   type = 'test'         outlet tes -- data karangan developer
--   type = 'marketplace'  Shopee & TikTok Shop -- outlet virtual, tak pernah
--                         memegang barang fisik
--
-- TIDAK memakai penyaring per-`type` untuk 'office': jenis itu memuat DUA hal
-- yang berbeda sifatnya -- GUDANG PUSAT (HQ) yang merupakan gudang sungguhan
-- dan pemegang persediaan terbesar, serta KANTOR PUSAT yang dummy. Menyaring
-- per-type akan membuang gudang utama. KANTOR PUSAT dibiarkan tampil (nilainya
-- kecil: 2 baris pasti Rp2,4 juta) dan dicatat sebagai pekerjaan bersih-bersih
-- data tersendiri, bukan disembunyikan lewat penyaring nama yang rapuh.
--
-- Sisanya (outlet, mitra, gudang) semuanya operasional dan tetap dihitung.
-- ============================================================================

CREATE OR REPLACE VIEW public.nilai_persediaan_spv
WITH (security_invoker = true) AS
WITH dasar AS (
  SELECT
    sb.outlet_id,
    sb.bahan_baku_id,
    sb.saldo,
    sb.updated_at,
    public.saldo_is_gram(sb)  AS skala_kecil_pasti,
    b.nama                    AS bahan,
    b.satuan,
    b.satuan_kecil,
    b.kategori,
    NULLIF(h.kemasan_qty, 0)  AS kemasan_qty,
    NULLIF(h.harga_beli, 0)   AS harga_beli
  FROM public.stok_balance sb
  JOIN public.bahan_baku b            ON b.id = sb.bahan_baku_id
  JOIN public.outlets o               ON o.id = sb.outlet_id
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = sb.bahan_baku_id
  WHERE b.is_active
    AND sb.saldo <> 0
    -- Lokasi non-operasional: lihat catatan di kepala berkas.
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace')
),
hitung AS (
  SELECT
    d.*,
    (d.harga_beli IS NULL OR d.kemasan_qty IS NULL) AS data_kurang,
    d.saldo * d.harga_beli / d.kemasan_qty          AS nilai_jika_kecil,
    d.saldo * d.harga_beli                          AS nilai_jika_besar
  FROM dasar d
),
kategori AS (
  SELECT
    h.*,
    CASE
      WHEN h.data_kurang                THEN 'data_belum_lengkap'
      WHEN h.skala_kecil_pasti          THEN 'pasti'
      WHEN h.kemasan_qty = 1            THEN 'pasti'
      ELSE 'skala_belum_pasti'
    END AS status
  FROM hitung h
),
nilai AS (
  SELECT
    k.*,
    CASE
      WHEN k.status = 'data_belum_lengkap'                 THEN 0
      WHEN k.skala_kecil_pasti                             THEN k.nilai_jika_kecil
      WHEN k.kemasan_qty = 1                               THEN k.nilai_jika_besar
      WHEN k.saldo > k.kemasan_qty                         THEN k.nilai_jika_kecil
      ELSE k.nilai_jika_besar
    END AS nilai_terbaik
  FROM kategori k
)
SELECT
  n.outlet_id,
  o.name        AS outlet,
  o.type        AS outlet_type,
  n.bahan_baku_id,
  n.bahan,
  n.kategori,
  n.satuan,
  n.satuan_kecil,
  n.kemasan_qty,
  n.harga_beli,
  n.saldo,
  n.status,
  (n.status = 'pasti') AS skala_pasti,
  CASE WHEN n.skala_kecil_pasti AND n.kemasan_qty IS NOT NULL
       THEN n.saldo / n.kemasan_qty
       ELSE n.saldo
  END AS jumlah_satuan_besar,
  n.nilai_terbaik AS nilai,
  CASE WHEN n.status = 'skala_belum_pasti'
       THEN LEAST(n.nilai_jika_kecil, n.nilai_jika_besar)
       ELSE n.nilai_terbaik
  END AS nilai_min,
  CASE WHEN n.status = 'skala_belum_pasti'
       THEN GREATEST(n.nilai_jika_kecil, n.nilai_jika_besar)
       ELSE n.nilai_terbaik
  END AS nilai_max,
  n.updated_at
FROM nilai n
JOIN public.outlets o ON o.id = n.outlet_id;

GRANT SELECT ON public.nilai_persediaan_spv TO authenticated;

COMMENT ON VIEW public.nilai_persediaan_spv IS
'Nilai persediaan per (outlet, bahan). security_invoker: tunduk RLS stok_balance & bahan_baku_harga. Lokasi type test & marketplace DIKECUALIKAN (keputusan owner 2026-09-08: outlet tes hanya untuk developer, jangan masuk perhitungan). Kolom status: pasti | skala_belum_pasti (nilai_min<>nilai_max, hilang setelah opname) | data_belum_lengkap (nilai=0, harga/kemasan_qty belum diisi). Jumlahkan PER STATUS, jangan digabung buta.';

-- ============================================================================
-- VERIFIKASI SETELAH DITERAPKAN
-- ============================================================================
--
-- 1. outlet tes & marketplace tidak boleh muncul sama sekali:
--
--      SELECT count(*) FROM nilai_persediaan_spv
--      WHERE outlet_type IN ('test','marketplace');
--      -- harus 0
--
-- 2. Total per status. Untuk 'pasti' dan 'data_belum_lengkap', ketiga angka
--    HARUS sama:
--
--      SELECT status, count(*) AS baris,
--             round(sum(nilai))     AS nilai,
--             round(sum(nilai_min)) AS batas_bawah,
--             round(sum(nilai_max)) AS batas_atas
--      FROM nilai_persediaan_spv GROUP BY status ORDER BY status;
--
--    Perkiraan setelah perubahan ini (per 8 September):
--      pasti              ~723 baris  ~Rp 358,8 juta
--      skala_belum_pasti     8 baris  ~Rp  75,0 juta  (BNR 7 + GUDANG SS ONLINE 1)
-- ============================================================================
