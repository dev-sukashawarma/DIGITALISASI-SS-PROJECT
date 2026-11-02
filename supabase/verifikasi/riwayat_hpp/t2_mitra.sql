-- supabase/verifikasi/riwayat_hpp/t2_mitra.sql — harapan: 'T2 LULUS'
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_m uuid; v_old numeric; v_nama text;
  v_p uuid; v_c uuid; v_c_old numeric; v_qty numeric;
  v_s uuid; v_s_old numeric;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  v_d1 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 2;
  v_a numeric; v_b numeric;
  v_mitra uuid[]; v_sebelum numeric; v_sesudah numeric;
  c_cileungsi constant uuid := '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT array_agg(id) INTO v_mitra FROM outlets WHERE type='mitra';

  -- menu biasa: override > 0, tanpa HPP kanal, bukan komponen paket, tidak baru diubah setelah v_d1, bukan 3 minuman khusus pra-2-Nov
  SELECT m.id, m.hpp_override, m.name INTO v_m, v_old, v_nama FROM menu_items m
   WHERE m.hpp_override > 0 AND NOT COALESCE(m.is_package,false) AND m.channel_hpp = '{}'::jsonb
     AND m.id NOT IN (
       '08a57f8f-f212-4205-a3eb-fb88066ae1b8'::uuid,
       'c543b78e-3341-44e0-b3ef-53349e71e3d3'::uuid,
       'c8427af3-0a41-48dd-9a08-6b93cd913ec6'::uuid
     )
     AND NOT EXISTS (SELECT 1 FROM menu_hpp_riwayat r WHERE r.menu_item_id = m.id AND r.berlaku_mulai > v_d1)
     AND NOT EXISTS (SELECT 1 FROM menu_packages mp WHERE mp.menu_item_id = m.id)
     AND (SELECT count(*) FROM menu_items x WHERE lower(btrim(split_part(x.name,'|',1))) = lower(btrim(split_part(m.name,'|',1)))) = 1
   ORDER BY m.id LIMIT 1;
  -- paket tanpa override, komponen C ber-override pada v_d2
  SELECT p.id, mp.menu_item_id, (SELECT hpp_override FROM menu_hpp_pada(c.id, v_d2)), COALESCE(mp.quantity,1) INTO v_p, v_c, v_c_old, v_qty
  FROM menu_items p JOIN menu_packages mp ON mp.package_id = p.id JOIN menu_items c ON c.id = mp.menu_item_id
  WHERE p.is_package AND COALESCE(p.hpp_override,0) = 0 AND p.channel_hpp = '{}'::jsonb
    AND c.hpp_override > 0 AND c.channel_hpp = '{}'::jsonb
    AND NOT EXISTS (SELECT 1 FROM menu_hpp_riwayat r WHERE r.menu_item_id = c.id AND r.berlaku_mulai = v_d2)
    AND (SELECT count(*) FROM menu_packages x WHERE x.package_id = p.id AND x.menu_item_id = mp.menu_item_id) = 1
  ORDER BY p.id LIMIT 1;
  -- menu ber-HPP SS Online
  SELECT id, (channel_hpp->>'ss_online')::numeric INTO v_s, v_s_old FROM menu_items m
   WHERE (channel_hpp->>'ss_online')::numeric > 0
     AND NOT EXISTS (SELECT 1 FROM menu_hpp_riwayat r WHERE r.menu_item_id = m.id AND r.kunci = 'ss_online' AND r.berlaku_mulai > v_d1)
   ORDER BY id LIMIT 1;
  IF v_admin IS NULL OR v_m IS NULL OR v_p IS NULL OR v_s IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  SELECT COALESCE(sum(cogs),0) INTO v_sebelum FROM get_mitra_orders_summary(v_mitra,
    (v_d1::timestamp AT TIME ZONE 'Asia/Jakarta'), ((v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') - interval '1 millisecond');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 1000), v_d2, 'uji t2');
  PERFORM ubah_hpp_menu(v_c, jsonb_build_object('hpp_override', v_c_old + 1000), v_d2, 'uji t2');
  PERFORM ubah_hpp_menu(v_s, jsonb_build_object('ss_online', v_s_old + 500), v_d2, 'uji t2');
  RESET ROLE;

  -- menu biasa: takeout OPEX untuk mitra non-Cileungsi (>= 1 Okt 2026), tetap x1,10 untuk Cileungsi & periode < 1 Okt 2026
  v_a := get_mitra_item_hpp_base(v_m, NULL, v_d1); v_b := get_mitra_item_hpp_base(v_m, NULL, v_d2);
  IF v_a <> v_old OR v_b <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (a): d1 % d2 %', v_a, v_b; END IF;
  IF get_mitra_item_hpp_base(v_m, NULL) <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (a2): tanpa tanggal bukan hari ini'; END IF;
  IF get_mitra_item_hpp(v_m, NULL, v_d1) <> round(v_old) THEN RAISE EXCEPTION 'GAGAL (b1): takeout opex non-Cileungsi d1'; END IF;
  IF get_mitra_item_hpp_by_name(v_nama, NULL, v_d1) <> round(v_old) THEN RAISE EXCEPTION 'GAGAL (c1): by_name non-Cileungsi d1'; END IF;
  IF get_mitra_item_hpp(v_m, NULL, v_d1, c_cileungsi) <> round(v_old * 1.10) THEN RAISE EXCEPTION 'GAGAL (b2): Cileungsi d1 harus x1,10'; END IF;
  IF get_mitra_item_hpp_by_name(v_nama, NULL, v_d1, c_cileungsi) <> round(v_old * 1.10) THEN RAISE EXCEPTION 'GAGAL (c2): by_name Cileungsi d1 harus x1,10'; END IF;
  IF get_mitra_item_hpp(v_m, NULL, DATE '2026-09-20') <> round(get_mitra_item_hpp_base(v_m, NULL, DATE '2026-09-20') * 1.10) THEN
    RAISE EXCEPTION 'GAGAL (b3): periode < 1 Okt 2026 harus tetap x1,10';
  END IF;
  IF get_mitra_item_hpp_murni(v_m, NULL, v_d1) <> round(v_old / 1.10, 2) THEN
    RAISE EXCEPTION 'GAGAL (b4): hpp_murni d1 tidak tepat';
  END IF;

  -- paket: selisih d2 - d1 = qty komponen × 1000
  v_a := get_mitra_item_hpp_base(v_p, NULL, v_d1); v_b := get_mitra_item_hpp_base(v_p, NULL, v_d2);
  IF v_b - v_a <> v_qty * 1000 THEN RAISE EXCEPTION 'GAGAL (d): paket d1 % d2 % qty %', v_a, v_b, v_qty; END IF;

  -- kanal SS Online
  v_a := get_mitra_item_hpp_base(v_s, 'ss_online', v_d1); v_b := get_mitra_item_hpp_base(v_s, 'ss_online', v_d2);
  IF v_a <> v_s_old OR v_b <> v_s_old + 500 THEN RAISE EXCEPTION 'GAGAL (e): kanal d1 % d2 %', v_a, v_b; END IF;

  -- ringkasan mitra hari d1 TIDAK boleh berubah
  SELECT COALESCE(sum(cogs),0) INTO v_sesudah FROM get_mitra_orders_summary(v_mitra,
    (v_d1::timestamp AT TIME ZONE 'Asia/Jakarta'), ((v_d1 + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') - interval '1 millisecond');
  IF v_sesudah <> v_sebelum THEN RAISE EXCEPTION 'GAGAL (f): cogs d1 bergeser % -> %', v_sebelum, v_sesudah; END IF;
END $$;
SELECT 'T2 LULUS' AS hasil;
ROLLBACK;
