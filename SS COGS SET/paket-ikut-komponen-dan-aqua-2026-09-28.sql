-- ARSIP — SUDAH DIJALANKAN 2026-09-28 (COMMIT). JANGAN DIJALANKAN ULANG.
-- Hasil: Aqua 1.541,67 mulai 1 Sep; 21 paket ikut komponen; COGS Sep owner 997.505.530 -> 997.886.223, mitra 516.650.401 -> 516.891.085; Agustus identik.
-- Samakan HPP 21 paket (Combo #1/#2/#3, DOUBLE SUKA, MEGABITE, NIKMAT, 12 bundling "+ AQUA")
-- dengan jumlah komponennya: override dikosongkan berlaku 1 Sep 2026. Isi paket sudah dicek cocok
-- dengan deskripsi. AYAM SEDANG + AQUA & MIX JUMBO + AQUA ditandai is_package dulu (kalau tidak,
-- HPP-nya jadi 0). HPP Aqua 1.500 -> 1.541,67 (harga beli master), berlaku 1 Sep. Keputusan owner 28 Sep 2026.
BEGIN;
CREATE TEMP TABLE _c (tahap text, periode text, owner numeric, mitra numeric);
CREATE TEMP TABLE _h (tahap text, paket text, internal numeric, mitra_pos numeric, mitra_tiktok numeric, mop numeric);

DO $$
DECLARE
  c_alasan constant text := 'HPP paket ikut jumlah komponen (isi sudah sesuai deskripsi) - via Claude atas permintaan owner 28 Sep 2026';
  v_admin uuid; v_mitra uuid[]; v_ids uuid[]; v_pkg uuid; n int;
  v_nama text[] := ARRAY['Combo #1','Combo #1 UP SIZE BESAR','Combo #1 UP SIZE JUMBO','Combo #2','Combo #2 UP SIZE BESAR','Combo #3',
    'DOUBLE SUKA','MEGABITE COMBO','PAKET NIKMAT','AYAM SEDANG + AQUA','AYAM BESAR + AQUA','AYAM JUMBO + AQUA','MIX BESAR + AQUA',
    'MIX JUMBO + AQUA','SAPI SEDANG + AQUA','SAPI BESAR + AQUA','SAPI JUMBO + AQUA','SUKA BEEF + AQUA','SUKA CHICKEN + AQUA',
    'SUKA FRIED CHICKEN + AQUA','SUKA SAMYANG + AQUA'];
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE name='Admin Dev' AND role='admin' AND status='active';
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';
  SELECT array_agg(m.id) INTO v_ids FROM menu_items m JOIN categories c ON c.id=m.category_id
   WHERE m.name = ANY(v_nama) AND c.name IN ('Combo','Promo Bundling Aqua') AND m.is_available;
  IF (SELECT count(*) FROM menu_items WHERE name='Aqua' AND NOT is_package) <> 1 THEN RAISE EXCEPTION 'menu Aqua tidak unik'; END IF;
  IF cardinality(v_ids) <> 21 THEN RAISE EXCEPTION 'Harus 21 paket, ketemu %', cardinality(v_ids); END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) i WHERE NOT EXISTS (SELECT 1 FROM menu_packages mp WHERE mp.package_id=i)) THEN
    RAISE EXCEPTION 'Ada paket tanpa isi';
  END IF;

  INSERT INTO _c SELECT 'sebelum', p.n, (get_owner_dashboard_summary(p.a,p.b)->>'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 September', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')) p(n,a,b);
  INSERT INTO _h SELECT 'sebelum', m.name,
    COALESCE(NULLIF(h.hpp_override,0),(SELECT sum(hc.hpp_override*mp.quantity) FROM menu_packages mp CROSS JOIN LATERAL menu_hpp_pada(mp.menu_item_id, DATE '2026-09-28') hc WHERE mp.package_id=m.id)),
    get_mitra_item_hpp(m.id, 'pos', DATE '2026-09-28'), get_mitra_item_hpp(m.id, 'tiktokgo', DATE '2026-09-28'),
    (SELECT max(hpp_override) FROM menu_outlet_prices mop JOIN outlets o ON o.id=mop.outlet_id WHERE mop.menu_item_id=m.id AND o.type='mitra')
  FROM menu_items m CROSS JOIN LATERAL menu_hpp_pada(m.id, DATE '2026-09-28') h WHERE m.id = ANY(v_ids);

  UPDATE menu_items SET is_package = true, updated_by = 'Claude (bundling Aqua ditandai paket, permintaan owner 28 Sep 2026)'
   WHERE id = ANY(v_ids) AND NOT is_package;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'is_package: % baris (harus 2)', n; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu((SELECT id FROM menu_items WHERE name='Aqua' AND NOT is_package), '{"hpp_override": 1541.67}'::jsonb, DATE '2026-09-01',
    'HPP Aqua = harga beli master AQUA 1.541,67/pcs - via Claude atas permintaan owner 28 Sep 2026');
  FOREACH v_pkg IN ARRAY v_ids LOOP
    PERFORM ubah_hpp_menu(v_pkg, '{"hpp_override": null}'::jsonb, DATE '2026-09-01', c_alasan);
  END LOOP;
  RESET ROLE;

  -- Layar HPP mitra (tampilan saja): samakan dengan komponen x 1,1
  UPDATE menu_outlet_prices mop SET hpp_override = round(k.komp * 1.1), updated_at = now()
  FROM (SELECT mp.package_id, sum(hc.hpp_override*mp.quantity) komp FROM menu_packages mp
          CROSS JOIN LATERAL menu_hpp_pada(mp.menu_item_id, DATE '2026-09-28') hc
         WHERE mp.package_id = ANY(v_ids) GROUP BY 1) k, outlets o
  WHERE mop.menu_item_id = k.package_id AND o.id = mop.outlet_id AND o.type='mitra' AND mop.hpp_override IS NOT NULL;

  INSERT INTO _c SELECT 'sesudah', p.n, (get_owner_dashboard_summary(p.a,p.b)->>'total_cogs')::numeric,
    (SELECT sum(cogs) FROM get_mitra_orders_summary(v_mitra, p.a, p.b))
  FROM (VALUES ('1 Agustus', timestamptz '2026-08-01 00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
               ('2 September', timestamptz '2026-09-01 00:00+07', timestamptz '2026-09-30 23:59:59.999+07')) p(n,a,b);
  INSERT INTO _h SELECT 'sesudah', m.name,
    COALESCE(NULLIF(h.hpp_override,0),(SELECT sum(hc.hpp_override*mp.quantity) FROM menu_packages mp CROSS JOIN LATERAL menu_hpp_pada(mp.menu_item_id, DATE '2026-09-28') hc WHERE mp.package_id=m.id)),
    get_mitra_item_hpp(m.id, 'pos', DATE '2026-09-28'), get_mitra_item_hpp(m.id, 'tiktokgo', DATE '2026-09-28'),
    (SELECT max(hpp_override) FROM menu_outlet_prices mop JOIN outlets o ON o.id=mop.outlet_id WHERE mop.menu_item_id=m.id AND o.type='mitra')
  FROM menu_items m CROSS JOIN LATERAL menu_hpp_pada(m.id, DATE '2026-09-28') h WHERE m.id = ANY(v_ids);

  IF EXISTS (SELECT 1 FROM _c s JOIN _c b ON b.periode=s.periode AND b.tahap='sebelum'
             WHERE s.tahap='sesudah' AND s.periode='1 Agustus' AND (s.owner IS DISTINCT FROM b.owner OR s.mitra IS DISTINCT FROM b.mitra)) THEN
    RAISE EXCEPTION 'GAGAL: Agustus ikut berubah';
  END IF;
  IF EXISTS (SELECT 1 FROM _h WHERE tahap='sesudah' AND (internal IS NULL OR internal=0 OR mitra_pos IS NULL OR mitra_pos=0)) THEN
    RAISE EXCEPTION 'GAGAL: ada paket ber-HPP 0 sesudah perubahan';
  END IF;
END $$;

SELECT 'AQUA | ' || (SELECT hpp_override FROM menu_hpp_pada((SELECT id FROM menu_items WHERE name='Aqua' AND NOT is_package), DATE '2026-09-01')) || ' | 31 Agu ' || COALESCE((SELECT hpp_override FROM menu_hpp_pada((SELECT id FROM menu_items WHERE name='Aqua' AND NOT is_package), DATE '2026-08-31'))::text,'-') AS baris
UNION ALL
SELECT 'COGS | ' || periode || ' | ' || tahap || ' | owner ' || round(owner) || ' | mitra ' || round(mitra) AS baris FROM _c
UNION ALL
SELECT 'PAKET | ' || b.paket || ' | internal ' || round(b.internal,1) || ' -> ' || round(s.internal,1)
    || ' | mitra pos ' || round(b.mitra_pos,2) || ' -> ' || round(s.mitra_pos,2)
    || ' | mitra tiktok ' || round(b.mitra_tiktok,2) || ' -> ' || round(s.mitra_tiktok,2)
    || ' | layar mitra ' || COALESCE(b.mop::text,'-') || ' -> ' || COALESCE(s.mop::text,'-')
FROM _h b JOIN _h s ON s.paket=b.paket AND s.tahap='sesudah' WHERE b.tahap='sebelum'
ORDER BY 1;
ROLLBACK;
