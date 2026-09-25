-- supabase/verifikasi/riwayat_hpp/t3_owner_summary.sql — harapan: 'T3 LULUS'
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_m uuid; v_old numeric;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  v_d1 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 2;
  v_d1_dari timestamptz; v_d1_sampai timestamptz; v_d2_dari timestamptz; v_d2_sampai timestamptz;
  v_c1_sebelum numeric; v_c1_sesudah numeric; v_c2_sebelum numeric; v_c2_sesudah numeric; v_harap numeric;
BEGIN
  v_d1_dari := v_d1::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_d1_sampai := (v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta' - interval '1 millisecond';
  v_d2_dari := v_d2::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_d2_sampai := (v_d2 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta' - interval '1 millisecond';
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;

  -- menu terlaris yang terjual di d1 DAN d2, override > 0, bukan paket, bukan komponen paket
  SELECT m.id, m.hpp_override INTO v_m, v_old
  FROM menu_items m
  WHERE m.hpp_override > 0 AND NOT COALESCE(m.is_package,false)
    AND NOT EXISTS (SELECT 1 FROM menu_packages mp WHERE mp.menu_item_id = m.id)
    AND EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE oi.menu_item_id = m.id AND o.status='completed' AND o.created_at BETWEEN v_d1_dari AND v_d1_sampai)
    AND EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE oi.menu_item_id = m.id AND o.status='completed' AND o.created_at BETWEEN v_d2_dari AND v_d2_sampai)
  ORDER BY m.id LIMIT 1;
  IF v_admin IS NULL OR v_m IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture (butuh menu terjual kemarin & lusa)'; END IF;

  v_c1_sebelum := (get_owner_dashboard_summary(v_d1_dari, v_d1_sampai) ->> 'total_cogs')::numeric;
  v_c2_sebelum := (get_owner_dashboard_summary(v_d2_dari, v_d2_sampai) ->> 'total_cogs')::numeric;

  -- selisih yang diharapkan di d2: qty × (baru − lama), outlet mitra memakai ROUND(×1,1)
  SELECT COALESCE(SUM(COALESCE(oi.quantity,1) * CASE WHEN ot.type = 'mitra'
                        THEN ROUND((v_old + 1000) * 1.1) - ROUND(v_old * 1.1)
                        ELSE 1000 END), 0)
    INTO v_harap
  FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN outlets ot ON ot.id = o.outlet_id
  WHERE oi.menu_item_id = v_m AND o.status = 'completed' AND o.created_at BETWEEN v_d2_dari AND v_d2_sampai;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 1000), v_d2, 'uji t3');
  RESET ROLE;

  v_c1_sesudah := (get_owner_dashboard_summary(v_d1_dari, v_d1_sampai) ->> 'total_cogs')::numeric;
  v_c2_sesudah := (get_owner_dashboard_summary(v_d2_dari, v_d2_sampai) ->> 'total_cogs')::numeric;

  IF v_c1_sesudah <> v_c1_sebelum THEN
    RAISE EXCEPTION 'GAGAL (a): cogs d1 bergeser % -> %', v_c1_sebelum, v_c1_sesudah; END IF;
  IF v_c2_sesudah - v_c2_sebelum <> v_harap THEN
    RAISE EXCEPTION 'GAGAL (b): selisih d2 %, harap %', v_c2_sesudah - v_c2_sebelum, v_harap; END IF;
  IF v_harap = 0 THEN RAISE EXCEPTION 'GAGAL (c): fixture tak menguji apa pun (selisih harapan 0)'; END IF;
END $$;
SELECT 'T3 LULUS' AS hasil;
ROLLBACK;
