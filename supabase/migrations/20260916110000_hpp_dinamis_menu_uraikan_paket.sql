-- =============================================================================
-- 20260916110000_hpp_dinamis_menu_uraikan_paket.sql
-- =============================================================================
-- `get_hpp_dinamis_menu` mencari resep langsung pada menu yang terjual. Untuk
-- PAKET tak pernah ada resep (memang begitu desainnya — HPP paket = jumlah
-- komponennya), jadi seluruh penjualan paket menyumbang HPP teoritis NOL dan
-- tampil sebagai "tanpa resep" di papan pembanding.
--
-- Diukur 2026-09-16, September berjalan, tanpa outlet tes/marketplace:
--   paket  1.268 porsi  Rp 56.038.000  = 6% omzet
--   satuan 24.476 porsi Rp 824.794.000 = 94%
-- Dan diperiksa: 44 paket, SEMUANYA punya komponen, dan SELURUH komponennya
-- sudah punya resep aktif. Jadi tak ada resep yang perlu ditulis — yang kurang
-- hanya penguraiannya di fungsi ini.
--
-- `trg_process_bom_stok` SUDAH menguraikan paket (dan menghormati
-- `order_items.package_choices` saat pelanggan memilih varian), sehingga HPP
-- AKTUAL sudah benar sejak awal. Migration ini menyamakan sisi TEORITIS dengan
-- perilaku BOM itu, memakai aturan pemilihan komponen yang sama.
--
-- Kontrak keluaran TIDAK berubah (9 kolom, nama & urutan sama) — mapper TS di
-- `apps/stok/src/app/actions/hppDinamis.ts` membacanya per nama.
--
-- `punya_resep` untuk paket = TRUE hanya bila SETIAP komponen punya resep;
-- kalau sebagian saja, totalnya akan diam-diam terlalu rendah, jadi lebih baik
-- ditandai tak lengkap (panel merender "—") daripada memajang angka salah.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.get_hpp_dinamis_menu(p_outlet uuid, p_from date, p_to date)
RETURNS TABLE(
  menu_item_id uuid, menu_nama text, harga_jual numeric, qty_terjual numeric,
  punya_resep boolean, hpp_override_unit numeric, hpp_override_total numeric,
  hpp_teoritis_total numeric, hpp_teoritis_unit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_view_hpp_dinamis() THEN
    RAISE EXCEPTION 'Tidak berwenang melihat HPP dinamis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_outlet NOT IN (SELECT public.outlet_ids_terhitung())
     OR p_outlet NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Outlet di luar cakupan' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to < p_from OR p_to - p_from > 92 THEN
    RAISE EXCEPTION 'Rentang maksimal 92 hari';
  END IF;

  RETURN QUERY
  WITH baris AS (
    -- Tetap per baris order_items: `package_choices` hilang kalau diagregasi duluan.
    SELECT oi.menu_item_id AS induk_id, oi.quantity AS qty, oi.package_choices,
           (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.outlet_id = p_outlet AND o.status = 'completed' AND oi.menu_item_id IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
  ),
  uraian AS (
    -- Menu satuan: dirinya sendiri.
    SELECT b.induk_id, b.induk_id AS komponen_id, b.qty, b.tgl
    FROM baris b
    JOIN public.menu_items m ON m.id = b.induk_id
    WHERE NOT COALESCE(m.is_package, false)
    UNION ALL
    -- Paket: tiap komponen x qty komponen; pilihan pelanggan menang, sama
    -- seperti trg_process_bom_stok.
    SELECT b.induk_id,
           COALESCE((b.package_choices ->> mp.id::text)::uuid, mp.menu_item_id),
           b.qty * COALESCE(mp.quantity, 1),
           b.tgl
    FROM baris b
    JOIN public.menu_items m ON m.id = b.induk_id AND m.is_package
    JOIN public.menu_packages mp ON mp.package_id = b.induk_id
  ),
  -- Diagregasi SEBELUM penetapan harga. Tanpa ini harga_bahan_efektif dipanggil
  -- sekali per (baris order x bahan) — terukur 7,2 detik untuk satu outlet
  -- 15 hari; setelah agregasi turun drastis. package_choices sudah teruraikan
  -- di `uraian`, jadi tidak ada informasi yang hilang di sini.
  uraian_agg AS (
    SELECT u.induk_id, u.komponen_id, u.tgl, SUM(u.qty) AS qty
    FROM uraian u GROUP BY u.induk_id, u.komponen_id, u.tgl
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (u.komponen_id) u.komponen_id, r.id AS resep_id
    FROM (SELECT DISTINCT ur.komponen_id FROM uraian_agg ur) u
    JOIN public.resep r ON r.menu_item_ref = u.komponen_id::text AND r.is_active
     AND ((r.scope = 'outlet' AND r.outlet_id = p_outlet) OR r.scope = 'global')
    ORDER BY u.komponen_id, CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END, r.id
  ),
  teoritis AS (
    SELECT u.induk_id, SUM(u.qty * ri.qty_per_porsi * h.harga_kecil) AS total
    FROM uraian_agg u
    JOIN resep_terpilih rt ON rt.komponen_id = u.komponen_id
    JOIN public.resep_item ri ON ri.resep_id = rt.resep_id
    CROSS JOIN LATERAL public.harga_bahan_efektif(p_outlet, ri.bahan_baku_id, u.tgl) h
    GROUP BY u.induk_id
  ),
  lengkap AS (
    -- Resep dianggap lengkap hanya bila SEMUA komponen menu itu punya resep.
    SELECT u.induk_id,
           bool_and(rt.komponen_id IS NOT NULL) AS semua_ber_resep
    FROM (SELECT DISTINCT ur.induk_id, ur.komponen_id FROM uraian_agg ur) u
    LEFT JOIN resep_terpilih rt ON rt.komponen_id = u.komponen_id
    GROUP BY u.induk_id
  ),
  -- ::numeric wajib: order_items.quantity integer, SUM-nya bigint, sedangkan
  -- kolom keluaran qty_terjual bertipe numeric.
  agg AS (SELECT b.induk_id, SUM(b.qty)::numeric AS qty FROM baris b GROUP BY b.induk_id)
  SELECT a.induk_id, m.name, COALESCE(m.price, 0), a.qty,
         COALESCE(lk.semua_ber_resep, false),
         COALESCE(m.hpp_override, 0), COALESCE(m.hpp_override, 0) * a.qty,
         CASE WHEN COALESCE(lk.semua_ber_resep, false) THEN te.total END,
         CASE WHEN COALESCE(lk.semua_ber_resep, false) AND a.qty > 0 THEN te.total / a.qty END
  FROM agg a
  JOIN public.menu_items m ON m.id = a.induk_id
  LEFT JOIN lengkap lk ON lk.induk_id = a.induk_id
  LEFT JOIN teoritis te ON te.induk_id = a.induk_id
  ORDER BY a.qty DESC;
END $$;

REVOKE ALL ON FUNCTION public.get_hpp_dinamis_menu(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hpp_dinamis_menu(uuid, date, date) TO authenticated;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.get_hpp_dinamis_menu(uuid,date,date)'::regprocedure) INTO v_def;
  IF v_def NOT LIKE '%menu_packages%' OR v_def NOT LIKE '%package_choices%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: fungsi tidak menguraikan paket';
  END IF;
  IF v_def NOT LIKE '%can_view_hpp_dinamis%' OR v_def NOT LIKE '%outlet_ids_terhitung%'
     OR v_def NOT LIKE '%variable_conflict%' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: gerbang/pragma hilang saat menulis ulang';
  END IF;
END $$;

COMMIT;
