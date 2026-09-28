-- ARSIP — SUDAH DIJALANKAN 2026-09-28 (COMMIT). JANGAN DIJALANKAN ULANG.
-- Hasil: COGS Sep owner 996.653.045 -> 996.854.061, mitra 515.948.397 -> 516.106.156; Agustus identik.
-- Rapikan paket Combo (keputusan owner 28 Sep 2026):
--  1. Isi 6 paket dibetulkan mengikuti deskripsinya, HPP paket ikut jumlah komponen (override dikosongkan, berlaku 1 Sep).
--  2. PAKET NONGKI 1/2 berisi Reguler + 1 minuman; HPP Reguler kasir = HPP Reguler file XX
--     (Ayam 10.316,9 / Sapi 10.595,2), berlaku 1 Sep; override Nongki dikosongkan.
--  3. Paket berisi Shawarmie dinonaktifkan (TIDAK dihapus; data penjualan tetap utuh).
-- Semua perubahan HPP lewat RPC ubah_hpp_menu atas nama Admin Dev. Tak ada baris yang dihapus.
BEGIN;
CREATE TEMP TABLE _c (tahap text, periode text, owner numeric, mitra numeric);
CREATE TEMP TABLE _h (paket text, isi text, hpp_28 numeric);

DO $$
DECLARE
  c_alasan constant text := 'Rapikan paket Combo: HPP ikut komponen sesuai deskripsi paket - via Claude atas permintaan owner 28 Sep 2026';
  v_admin uuid; v_mitra uuid[];
  v_ice uuid; v_oj uuid; v_ayam_jumbo uuid; v_sapi_jumbo uuid;
  v_sapi_sedang uuid; v_ayam_sedang uuid; v_ayam_reg uuid; v_sapi_reg uuid;
  n int; v_pkg uuid; k text;
  v_paket_fix text[] := ARRAY['Combo #2 UP SIZE JUMBO','Combo #3 UP SIZE JUMBO','Combo 4','MIX CHEESE COMBO',
                              'SPESIAL SUKA LOVERS','TRIPLE SERU','PAKET NONGKI 1','PAKET NONGKI 2'];
  v_paket_off text[] := ARRAY['Combo 5','Family Bundling','PAKET COUPLE','PAKET MOOD','SUKA MERDEKA'];
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';
  SELECT m.id INTO v_ice FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Ice Tea' AND c.name='Suka Drink';
  SELECT m.id INTO v_oj  FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Orange Juice' AND c.name='Suka Drink';
  SELECT m.id INTO v_ayam_jumbo  FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Original Ayam Jumbo'  AND c.name='Original Shawarma Ayam';
  SELECT m.id INTO v_ayam_sedang FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Original Ayam Sedang' AND c.name='Original Shawarma Ayam';
  SELECT m.id INTO v_ayam_reg    FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Original Ayam Reguler' AND c.name='Original Shawarma Ayam';
  SELECT m.id INTO v_sapi_jumbo  FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Original Sapi Jumbo'  AND c.name='Original Shawarma Sapi';
  SELECT m.id INTO v_sapi_sedang FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Original Sapi Sedang' AND c.name='Original Shawarma Sapi';
  SELECT m.id INTO v_sapi_reg    FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.name='Original Sapi Reguler' AND c.name='Original Shawarma Sapi';
  IF v_admin IS NULL OR v_ice IS NULL OR v_oj IS NULL OR v_ayam_jumbo IS NULL OR v_sapi_jumbo IS NULL OR v_sapi_sedang IS NULL
     OR v_ayam_sedang IS NULL OR v_ayam_reg IS NULL OR v_sapi_reg IS NULL THEN RAISE EXCEPTION 'fixture menu tidak lengkap'; END IF;
  IF (SELECT count(*) FROM menu_items WHERE name = ANY(v_paket_fix) AND is_package) <> 8 THEN RAISE EXCEPTION 'paket fix tak lengkap'; END IF;
  IF (SELECT count(*) FROM menu_items WHERE name = ANY(v_paket_off) AND is_package) <> 5 THEN RAISE EXCEPTION 'paket off tak lengkap'; END IF;

  INSERT INTO _c SELECT 'sebelum', p.n,
    (get_owner_dashboard_summary(p.a, p.b)->>'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 September', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')) p(n,a,b);

  -- 1. Isi paket (UPDATE di tempat / INSERT; tak ada yang dihapus)
  UPDATE menu_packages mp SET menu_item_id = v_ayam_jumbo
   FROM menu_items p WHERE p.id=mp.package_id AND p.name='Combo #2 UP SIZE JUMBO' AND mp.menu_item_id=v_sapi_jumbo;
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Combo #2 JUMBO: % baris', n; END IF;

  INSERT INTO menu_packages (package_id, menu_item_id, quantity, or_menu_item_id)
  SELECT p.id, v_ice, 1, v_oj FROM menu_items p WHERE p.name='Combo #3 UP SIZE JUMBO' AND p.is_package
    AND NOT EXISTS (SELECT 1 FROM menu_packages x WHERE x.package_id=p.id AND x.menu_item_id=v_ice);
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Combo #3 JUMBO: % baris', n; END IF;

  UPDATE menu_packages mp SET quantity = 2 FROM menu_items p
   WHERE p.id=mp.package_id AND p.name='Combo 4' AND mp.menu_item_id=v_ice AND mp.quantity=1;
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Combo 4: % baris', n; END IF;

  UPDATE menu_packages mp SET quantity = 1 FROM menu_items p
   WHERE p.id=mp.package_id AND p.name IN ('MIX CHEESE COMBO','SPESIAL SUKA LOVERS','TRIPLE SERU','PAKET NONGKI 1','PAKET NONGKI 2')
     AND mp.menu_item_id=v_ice AND mp.quantity=2;
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>5 THEN RAISE EXCEPTION 'minuman 2->1: % baris', n; END IF;

  UPDATE menu_packages mp SET menu_item_id = v_sapi_reg FROM menu_items p
   WHERE p.id=mp.package_id AND p.name='PAKET NONGKI 1' AND mp.menu_item_id=v_sapi_sedang;
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Nongki 1: % baris', n; END IF;
  UPDATE menu_packages mp SET menu_item_id = v_ayam_reg FROM menu_items p
   WHERE p.id=mp.package_id AND p.name='PAKET NONGKI 2' AND mp.menu_item_id=v_ayam_sedang;
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Nongki 2: % baris', n; END IF;

  -- 2 & HPP: lewat RPC sebagai Admin Dev
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_ayam_reg, '{"hpp_override": 10316.9}'::jsonb, DATE '2026-09-01', c_alasan);
  PERFORM ubah_hpp_menu(v_sapi_reg, '{"hpp_override": 10595.2}'::jsonb, DATE '2026-09-01', c_alasan);
  FOR v_pkg IN SELECT id FROM menu_items WHERE name = ANY(v_paket_fix) AND is_package LOOP
    PERFORM ubah_hpp_menu(v_pkg, '{"hpp_override": null}'::jsonb, DATE '2026-09-01', c_alasan);
  END LOOP;
  RESET ROLE;

  -- 3. Nonaktifkan paket berisi Shawarmie (tidak dihapus)
  UPDATE menu_items SET is_available = false, is_available_online = false, tampil_di_app = false,
         updated_by = 'Claude (paket berisi Shawarmie dinonaktifkan, permintaan owner 28 Sep 2026)'
   WHERE name = ANY(v_paket_off) AND is_package;
  GET DIAGNOSTICS n = ROW_COUNT; IF n<>5 THEN RAISE EXCEPTION 'nonaktif: % baris', n; END IF;

  INSERT INTO _c SELECT 'sesudah', p.n,
    (get_owner_dashboard_summary(p.a, p.b)->>'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 September', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')) p(n,a,b);
  IF EXISTS (SELECT 1 FROM _c s JOIN _c b ON b.periode=s.periode AND b.tahap='sebelum'
             WHERE s.tahap='sesudah' AND s.periode='1 Agustus'
               AND (s.owner IS DISTINCT FROM b.owner OR s.mitra IS DISTINCT FROM b.mitra)) THEN
    RAISE EXCEPTION 'GAGAL: Agustus ikut berubah';
  END IF;

  INSERT INTO _h
  SELECT p.name,
    (SELECT string_agg(mp.quantity||'x '||mi.name||COALESCE('/'||om.name,''), ' + ' ORDER BY mi.name)
       FROM menu_packages mp JOIN menu_items mi ON mi.id=mp.menu_item_id LEFT JOIN menu_items om ON om.id=mp.or_menu_item_id
      WHERE mp.package_id=p.id),
    COALESCE(NULLIF(h.hpp_override,0),
      (SELECT sum(hc.hpp_override*mp.quantity) FROM menu_packages mp CROSS JOIN LATERAL menu_hpp_pada(mp.menu_item_id, DATE '2026-09-28') hc WHERE mp.package_id=p.id))
  FROM menu_items p CROSS JOIN LATERAL menu_hpp_pada(p.id, DATE '2026-09-28') h
  WHERE p.name = ANY(v_paket_fix) AND p.is_package;
END $$;

SELECT 'COGS | ' || periode || ' | ' || tahap || ' | owner ' || round(owner) || ' | mitra ' || round(mitra) AS baris FROM _c
UNION ALL SELECT 'PAKET | ' || paket || ' | ' || isi || ' | ' || hpp_28 FROM _h
UNION ALL SELECT 'OFF | ' || name || ' | aktif=' || is_available || ' | online=' || is_available_online FROM menu_items
  WHERE name IN ('Combo 5','Family Bundling','PAKET COUPLE','PAKET MOOD','SUKA MERDEKA')
ORDER BY 1;
ROLLBACK;
