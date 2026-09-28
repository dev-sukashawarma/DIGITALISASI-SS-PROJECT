-- ARSIP — SUDAH DIJALANKAN 2026-09-28 (COMMIT). JANGAN DIJALANKAN ULANG.
-- Hasil: COGS owner & mitra 19-30 Sep +34.856 (1 porsi MITRA CIBUBUR 22 Sep); 1-18 Sep tak berubah.
-- SHAWARMIE DUO VARIAN: 1 porsi terjual di TikTok GO MITRA CIBUBUR 22 Sep 2026 setelah Shawarmie off
-- (17 Sep; HPP komponennya dikosongkan mulai 19 Sep) -> HPP-nya 0. Keputusan owner 28 Sep: beri HPP
-- paket = 31.687,7 (file XX, paket TikTok GO), berlaku 19 Sep. Mitra otomatis x1,1 = 34.856,47.
BEGIN;
CREATE TEMP TABLE _c (tahap text, owner numeric, mitra numeric, cibubur numeric, owner_1_18 numeric);
DO $$
DECLARE
  v_admin uuid; v_pkg uuid; v_mitra uuid[]; v_cbr uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  SELECT id INTO v_pkg FROM menu_items WHERE name='SHAWARMIE DUO VARIAN' AND is_package;
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';
  SELECT id INTO v_cbr FROM outlets WHERE name='MITRA CIBUBUR';
  IF v_admin IS NULL OR v_pkg IS NULL OR v_cbr IS NULL THEN RAISE EXCEPTION 'fixture tidak lengkap'; END IF;

  INSERT INTO _c SELECT 'sebelum',
    (get_owner_dashboard_summary(timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')->>'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')),
    (SELECT sum(cogs) FROM get_mitra_orders_summary(ARRAY[v_cbr], timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')),
    (get_owner_dashboard_summary(timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07')->>'total_cogs')::numeric;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_pkg, '{"hpp_override": 31687.7}'::jsonb, DATE '2026-09-19',
    'SHAWARMIE DUO VARIAN terjual 22 Sep di TikTok GO Cibubur setelah Shawarmie off 17 Sep; HPP paket file XX - via Claude atas permintaan owner 28 Sep 2026');
  RESET ROLE;

  INSERT INTO _c SELECT 'sesudah',
    (get_owner_dashboard_summary(timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')->>'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')),
    (SELECT sum(cogs) FROM get_mitra_orders_summary(ARRAY[v_cbr], timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')),
    (get_owner_dashboard_summary(timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07')->>'total_cogs')::numeric;

  IF (SELECT owner_1_18 FROM _c WHERE tahap='sesudah') IS DISTINCT FROM (SELECT owner_1_18 FROM _c WHERE tahap='sebelum') THEN
    RAISE EXCEPTION 'GAGAL: COGS 1-18 Sep ikut berubah';
  END IF;
  IF (SELECT hpp_override FROM menu_hpp_pada(v_pkg, DATE '2026-09-18')) IS NOT NULL THEN
    RAISE EXCEPTION 'GAGAL: override paket bocor ke 18 Sep';
  END IF;
END $$;
SELECT tahap || ' | owner 19-30 ' || round(owner,2) || ' | mitra 19-30 ' || round(mitra,2) || ' | Cibubur Sep ' || round(cibubur,2) || ' | owner 1-18 ' || round(owner_1_18) AS baris FROM _c ORDER BY tahap DESC;
ROLLBACK;
