-- 20300133000000_omzet_kecualikan_outlet_tes.sql
--
-- Mengeluarkan outlet uji developer dari dua view omzet yang masih bocor.
-- Melanjutkan 20300132000000 (HPP & waste) dan 20300131000000 (nilai persediaan).
--
-- ============================================================================
-- ATURAN (keputusan owner, 8 September 2026)
-- ============================================================================
--
--   "outlet tes hanya untuk testing oleh developer, jadi jangan masuk ke
--    perhitungan"
--
-- ============================================================================
-- CAKUPAN: HANYA DUA VIEW INI
-- ============================================================================
--
-- Diperiksa satu per satu, bukan ditebak. Baris milik outlet tes:
--
--   sales_summary_spv          7   <-- ditambal di sini
--   menu_sales_spv            26   <-- ditambal di sini
--   sales_daily_spv            0
--   sales_hourly_spv           0
--   sales_items_spv            0
--   daily_target_progress_spv  0
--
-- Empat view terakhir sudah bersih dengan sendirinya, jadi TIDAK disentuh --
-- menulis ulang view yang tak bermasalah cuma menambah risiko tanpa manfaat.
--
-- ============================================================================
-- BESARNYA, supaya tidak dibesar-besarkan
-- ============================================================================
--
-- Omzet 30 hari terakhir: outlet Rp888,1 jt (51,0%), mitra Rp850,9 jt (48,9%),
-- test Rp0,88 jt (0,051%). Karena semua view ini dikelompokkan PER OUTLET,
-- outlet tes muncul sebagai barisnya sendiri -- ia tidak pernah mencemari
-- angka outlet lain. Yang hilang setelah perbaikan ini: satu baris palsu di
-- laporan, dan 0,05% pada total perusahaan.
--
-- ============================================================================
-- CATATAN TEKNIS
-- ============================================================================
--
-- Isi kedua view disalin VERBATIM dari pg_get_viewdef(); satu-satunya tambahan
-- adalah klausa penyaring. `security_barrier = true` dipertahankan pada
-- keduanya -- kalau hilang, perencana kueri boleh mendorong predikat pengguna
-- ke bawah penyaring, yang membocorkan baris lewat pesan galat/timing.
--
-- Penyaring memakai `outlets.type`, BUKAN nama outlet: nama bisa diubah kapan
-- saja, jenis tidak. Dan BUKAN `is_active`: outlet tes justru is_active=true,
-- dan banyak agregasi memang tidak memeriksanya.
--
-- Marketplace (Shopee/TikTok Shop) SENGAJA tidak dikecualikan: omzetnya sah
-- dihitung. Yang dikeluarkan dari nilai persediaan (20300131000000) adalah
-- soal barang fisik, bukan omzet.
-- ============================================================================

-- ------------------------------------------------------------------
-- sales_summary_spv — sudah men-JOIN outlets, cukup tambah WHERE
-- ------------------------------------------------------------------

CREATE OR REPLACE VIEW public.sales_summary_spv
WITH (security_barrier = true) AS
 SELECT o.outlet_id,
    ou.name AS outlet_name,
    o.sales_source,
    (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    COALESCE(sum(o.total_amount) FILTER (WHERE o.status = 'completed'::text), 0::numeric) AS omzet,
    count(*) FILTER (WHERE o.status = 'completed'::text) AS jumlah_order_completed,
    count(*) AS jumlah_order_all
   FROM orders o
     JOIN outlets ou ON ou.id = o.outlet_id
  WHERE COALESCE(ou.type, ''::text) <> 'test'::text
  GROUP BY o.outlet_id, ou.name, o.sales_source, ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date);

-- ------------------------------------------------------------------
-- menu_sales_spv — tidak men-JOIN outlets, jadi lewat subquery.
-- Sengaja TIDAK menambah JOIN: itu akan memaksa kolom baru masuk GROUP BY
-- dan mengubah bentuk hasilnya.
-- ------------------------------------------------------------------

CREATE OR REPLACE VIEW public.menu_sales_spv
WITH (security_barrier = true) AS
 SELECT o.outlet_id,
    o.sales_source,
    (o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS sales_date,
    lower(TRIM(BOTH FROM regexp_replace(oi.menu_item_name, '\s+'::text, ' '::text, 'g'::text))) AS menu_key,
    max(oi.menu_item_name) AS menu_name,
    sum(oi.quantity) AS qty,
    sum(oi.subtotal) AS revenue
   FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'completed'::text
    AND o.outlet_id NOT IN (
      SELECT ou.id FROM public.outlets ou WHERE COALESCE(ou.type, ''::text) = 'test'::text
    )
  GROUP BY o.outlet_id, o.sales_source, ((o.created_at AT TIME ZONE 'Asia/Jakarta'::text)::date), (lower(TRIM(BOTH FROM regexp_replace(oi.menu_item_name, '\s+'::text, ' '::text, 'g'::text))));

-- ============================================================================
-- VERIFIKASI SETELAH DITERAPKAN
-- ============================================================================
--
-- 1. Kedua view tak lagi memuat outlet tes:
--
--      SELECT 'sales_summary_spv' AS v, count(*) FROM sales_summary_spv s
--        JOIN outlets o ON o.id = s.outlet_id WHERE COALESCE(o.type,'') = 'test'
--      UNION ALL
--      SELECT 'menu_sales_spv', count(*) FROM menu_sales_spv m
--        JOIN outlets o ON o.id = m.outlet_id WHERE COALESCE(o.type,'') = 'test';
--      -- keduanya harus 0
--
-- 2. security_barrier tetap terpasang (kalau hilang, ini regresi keamanan):
--
--      SELECT relname, reloptions FROM pg_class
--      WHERE relname IN ('sales_summary_spv','menu_sales_spv');
--      -- keduanya harus {security_barrier=true}
--
-- 3. Angka outlet lain TIDAK berubah -- bandingkan total omzet sebelum/sesudah
--    untuk satu outlet nyata; selisihnya harus nol.
-- ============================================================================
