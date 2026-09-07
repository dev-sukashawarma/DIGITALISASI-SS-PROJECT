-- 20300129000000_nilai_persediaan_view.sql
--
-- View nilai persediaan per (outlet, bahan) untuk halaman /stok/nilai-persediaan.
--
-- ============================================================================
-- LATAR
-- ============================================================================
--
-- Nilai persediaan -- uang yang sedang berbentuk barang -- tidak dilaporkan di
-- halaman mana pun. Diverifikasi 3 September 2026: nol kode aplikasi yang
-- menghitungnya, padahal ini aset terbesar setelah kas.
--
-- ============================================================================
-- TIGA KATEGORI, BUKAN SATU ANGKA
-- ============================================================================
--
-- Menghitung total nilai persediaan hari ini TIDAK bisa menghasilkan satu angka
-- yang bisa dipegang, karena dua hal:
--
-- 1. MIGRASI SKALA SATUAN BELUM SELESAI. Skala sebuah baris ditentukan
--    `saldo_is_gram(sb)` = ada opname_selisih sejak 2026-08-01 20:32. Untuk baris
--    yang belum pernah di-opname, isinya bisa satuan besar (Kg/Roll/Dus) atau
--    satuan kecil (gram/cm/lembar) -- bedanya sebesar faktor kemasan.
--    Lihat 20300128000000_finalize_opname_sadar_skala.sql.
--
-- 2. MASTER DATA BELUM LENGKAP. Per 3 September, dari 787 baris stok aktif:
--    13 belum punya harga beli, 32 belum punya kemasan_qty. Tanpa keduanya,
--    nilainya tidak bisa dihitung sama sekali.
--
-- Karena itu view ini memisahkan tegas lewat kolom `status`:
--
--   'pasti'               nilai = nilai_min = nilai_max. Bisa dipegang.
--   'skala_belum_pasti'   nilai = tafsir terbaik; rentang sebenarnya ada di
--                         nilai_min..nilai_max. Hilang sendiri setelah opname.
--   'data_belum_lengkap'  nilai = 0. Harga atau isi kemasan belum diisi;
--                         BUKAN berarti stoknya tak bernilai.
--
-- UI wajib menjumlahkan per status, jangan digabung buta. Kalau digabung, angka
-- 'data_belum_lengkap' yang bernilai 0 akan tampak seperti stok gratis.
--
-- CATATAN: percobaan awal view ini memakai COALESCE(kemasan_qty, 1) sehingga
-- bahan tanpa isi kemasan dinilai seolah satuan besar. Itu menggelembungkan
-- total dan disengaja dibuang -- lebih baik jujur "belum bisa dihitung" daripada
-- memberi angka yang terlihat pasti.
--
-- ============================================================================
-- AKSES
-- ============================================================================
--
-- security_invoker = true (BUKAN definer) -- sengaja. Dengan begitu RLS
-- stok_balance berlaku (pengguna hanya melihat outlet yang boleh diakses) dan
-- RLS bahan_baku_harga berlaku (hanya admin/owner/kitchen/purchasing/
-- admin_finance bisa membaca harga, policy bbh_read).
--
-- Role di luar itu mendapat baris tanpa harga, bukan angka salah. Halaman di app
-- stok karena itu dibatasi ke lima role yang sama (canViewNilaiPersediaan di
-- AppSidebar) supaya tidak ada yang membuka halaman lalu menyangka stoknya nol.
--
-- TIDAK memakai Server Action service-role seperti halaman Master Harga Bahan
-- Baku -- nilai persediaan adalah angka keuangan, lebih baik tunduk RLS.
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
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = sb.bahan_baku_id
  WHERE b.is_active
    AND sb.saldo <> 0
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
      -- Tafsir terbaik untuk baris belum pasti: saldo yang jauh lebih besar
      -- dari isi kemasan hampir pasti sudah dalam satuan kecil.
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
  -- Untuk status selain 'skala_belum_pasti', rentangnya menciut ke satu titik.
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
'Nilai persediaan per (outlet, bahan). security_invoker: tunduk RLS stok_balance & bahan_baku_harga. Kolom status: pasti | skala_belum_pasti (nilai_min<>nilai_max, hilang setelah opname) | data_belum_lengkap (nilai=0, harga/kemasan_qty belum diisi). Jumlahkan PER STATUS, jangan digabung buta.';

-- ============================================================================
-- VERIFIKASI SETELAH DITERAPKAN
-- ============================================================================
--
-- 1. Total per status. Untuk status 'pasti' dan 'data_belum_lengkap', ketiga
--    angka HARUS sama; kalau berbeda, ada cacat di rumusnya.
--
--      SELECT status, count(*) AS baris,
--             round(sum(nilai))     AS nilai,
--             round(sum(nilai_min)) AS batas_bawah,
--             round(sum(nilai_max)) AS batas_atas
--      FROM nilai_persediaan_spv GROUP BY status ORDER BY status;
--
-- 2. Per outlet:
--
--      SELECT outlet, round(sum(nilai)) AS nilai,
--             count(*) FILTER (WHERE status = 'skala_belum_pasti')  AS belum_pasti,
--             count(*) FILTER (WHERE status = 'data_belum_lengkap') AS data_kurang
--      FROM nilai_persediaan_spv GROUP BY outlet ORDER BY 2 DESC;
--
-- 3. Cek RLS: login sebagai crew/kasir, kolom harga_beli harus NULL (bukan
--    angka), sehingga statusnya jatuh ke 'data_belum_lengkap'.
-- ============================================================================
