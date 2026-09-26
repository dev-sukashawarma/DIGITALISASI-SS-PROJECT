-- ⚠️ SUDAH DIJALANKAN di produksi 26 Sep 2026 (commit). JANGAN dijalankan ulang — skrip ini arsip/jejak audit.
-- Menjalankan ulang: input HPP akan meng-upsert baris yang sama (aman), tapi skrip Shawarmie berhenti sendiri (menu sudah ada / baris ≠ 279).
-- Shawarmie Ayam/Sapi dibuat ulang NONAKTIF (dihentikan per 19 Sep 2026) hanya agar penjualan
-- 1–18 Sep punya HPP: Ayam 14.500, Sapi 16.500 berlaku 1 Sep, dikosongkan lagi mulai 19 Sep.
-- Dipasang lagi sebagai isi paket SHAWARMIE DUO VARIAN (nonaktif). Dicatat atas nama Admin Dev.
BEGIN;
CREATE TEMP TABLE _cek (tahap text, periode text, owner_cogs numeric, mitra_cogs numeric);
CREATE TEMP TABLE _pada (menu text, tgl date, hpp numeric);

DO $$
DECLARE
  c_alasan constant text := 'Shawarmie dihentikan 19 Sep 2026; HPP 1–18 Sep diinput via Claude atas permintaan owner 26 Sep 2026';
  v_admin uuid; v_ayam uuid; v_sapi uuid; v_paket constant uuid := '10c415f9-4fe7-42b7-8f5f-7c22c930bc11';
  v_mitra uuid[];
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Admin Dev tidak ada'; END IF;
  IF EXISTS (SELECT 1 FROM menu_items WHERE lower(btrim(split_part(name,'|',1))) IN ('shawarmie ayam','shawarmie sapi')) THEN
    RAISE EXCEPTION 'Menu Shawarmie sudah ada — berhenti';
  END IF;
  IF EXISTS (SELECT 1 FROM menu_packages WHERE package_id = v_paket) THEN RAISE EXCEPTION 'Paket sudah punya komponen — berhenti'; END IF;

  INSERT INTO _cek SELECT 'sebelum', p.n,
    (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('1-18 Sep', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07'),
               ('19-25 Sep', timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-25 23:59:59.999+07')) p(n, a, b);

  INSERT INTO menu_items (name, price, category_id, is_package, is_available, is_available_online, hpp_override, updated_by)
  VALUES ('Shawarmie Ayam', 24000, (SELECT id FROM categories WHERE name='Original Shawarma Ayam'), false, false, false, NULL, 'Claude (Shawarmie dihentikan 19 Sep; hanya untuk HPP 1–18 Sep)')
  RETURNING id INTO v_ayam;
  INSERT INTO menu_items (name, price, category_id, is_package, is_available, is_available_online, hpp_override, updated_by)
  VALUES ('Shawarmie Sapi', 27000, (SELECT id FROM categories WHERE name='Original Shawarma Sapi'), false, false, false, NULL, 'Claude (Shawarmie dihentikan 19 Sep; hanya untuk HPP 1–18 Sep)')
  RETURNING id INTO v_sapi;
  INSERT INTO menu_packages (package_id, menu_item_id, quantity) VALUES (v_paket, v_ayam, 1), (v_paket, v_sapi, 1);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_ayam, '{"hpp_override": 14500}'::jsonb, DATE '2026-09-01', c_alasan);
  PERFORM ubah_hpp_menu(v_sapi, '{"hpp_override": 16500}'::jsonb, DATE '2026-09-01', c_alasan);
  PERFORM ubah_hpp_menu(v_ayam, '{"hpp_override": null}'::jsonb, DATE '2026-09-19', c_alasan);
  PERFORM ubah_hpp_menu(v_sapi, '{"hpp_override": null}'::jsonb, DATE '2026-09-19', c_alasan);
  RESET ROLE;

  INSERT INTO _pada SELECT n, t, (SELECT hpp_override FROM menu_hpp_pada(i, t))
  FROM (VALUES ('Shawarmie Ayam', v_ayam), ('Shawarmie Sapi', v_sapi)) m(n, i)
  CROSS JOIN (VALUES (DATE '2026-08-31'), (DATE '2026-09-01'), (DATE '2026-09-18'), (DATE '2026-09-19')) d(t);

  INSERT INTO _cek SELECT 'sesudah', p.n,
    (get_owner_dashboard_summary(p.a, p.b) ->> 'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('1-18 Sep', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-18 23:59:59.999+07'),
               ('19-25 Sep', timestamptz '2026-09-19 00:00+07', timestamptz '2026-09-25 23:59:59.999+07')) p(n, a, b);

  -- Asersi: Agustus & 19-25 Sep tidak berubah; 18 Sep ada HPP, 31 Agu & 19 Sep kosong
  IF EXISTS (SELECT 1 FROM _cek s JOIN _cek b ON b.periode = s.periode AND b.tahap = 'sebelum'
             WHERE s.tahap = 'sesudah' AND s.periode IN ('Agustus','19-25 Sep')
               AND (s.owner_cogs IS DISTINCT FROM b.owner_cogs OR s.mitra_cogs IS DISTINCT FROM b.mitra_cogs)) THEN
    RAISE EXCEPTION 'GAGAL: Agustus atau 19-25 Sep ikut berubah';
  END IF;
  IF EXISTS (SELECT 1 FROM _pada WHERE (tgl IN (DATE '2026-08-31', DATE '2026-09-19') AND hpp IS NOT NULL)
                                   OR (tgl IN (DATE '2026-09-01', DATE '2026-09-18') AND hpp IS NULL)) THEN
    RAISE EXCEPTION 'GAGAL: rentang berlaku HPP salah';
  END IF;
END $$;
COMMIT;
SELECT tahap || ' | ' || periode || ' | owner ' || owner_cogs || ' | mitra ' || round(mitra_cogs) AS baris FROM _cek
UNION ALL SELECT 'HPP ' || menu || ' ' || tgl || ' = ' || COALESCE(hpp::text, 'kosong') FROM _pada
ORDER BY 1;
