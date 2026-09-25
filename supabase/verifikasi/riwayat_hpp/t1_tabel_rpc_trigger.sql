-- supabase/verifikasi/riwayat_hpp/t1_tabel_rpc_trigger.sql — harapan: tanpa error, lalu 'T1 LULUS'
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_crew uuid; v_af uuid;
  v_m uuid; v_m2 uuid; v_old numeric; v_old2 numeric;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  v_batas date;
  v_ok boolean; v_n int; v_h numeric; v_ch jsonb;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin'         AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'          AND status='active' LIMIT 1;
  SELECT id INTO v_af    FROM outlet_staff WHERE role='admin_finance' AND status='active' LIMIT 1;
  IF v_admin IS NULL OR v_crew IS NULL OR v_af IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf'; END IF;

  SELECT id, hpp_override INTO v_m, v_old FROM menu_items
   WHERE hpp_override > 0 AND NOT COALESCE(is_package,false) ORDER BY id LIMIT 1;
  SELECT id, hpp_override INTO v_m2, v_old2 FROM menu_items
   WHERE hpp_override > 0 AND NOT COALESCE(is_package,false) AND id <> v_m ORDER BY id LIMIT 1;
  IF v_m IS NULL OR v_m2 IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture menu'; END IF;
  v_batas := CASE WHEN EXTRACT(DAY FROM v_hari_ini) <= 10
                  THEN (date_trunc('month', v_hari_ini) - INTERVAL '1 month')::date
                  ELSE date_trunc('month', v_hari_ini)::date END;

  -- (a) seed: tiap menu punya baris hpp_override
  SELECT count(*) INTO v_n FROM menu_items m
   WHERE NOT EXISTS (SELECT 1 FROM menu_hpp_riwayat r WHERE r.menu_item_id=m.id AND r.kunci='hpp_override');
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (a): % menu tanpa seed', v_n; END IF;

  -- (b) nol pergeseran: rekonstruksi hari ini = menu_items, untuk SEMUA menu
  SELECT count(*) INTO v_n FROM menu_items m CROSS JOIN LATERAL menu_hpp_pada(m.id, v_hari_ini) h
   WHERE h.hpp_override IS DISTINCT FROM m.hpp_override
      OR h.channel_hpp IS DISTINCT FROM COALESCE((
           SELECT jsonb_object_agg(e.key, _hpp_nilai_json(e.value))
           FROM jsonb_each(COALESCE(m.channel_hpp,'{}'::jsonb)) e
           WHERE _hpp_nilai_json(e.value) IS NOT NULL), '{}'::jsonb);
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (b): % menu bergeser', v_n; END IF;

  -- (c) admin: ubah mundur ke kemarin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 1000), v_d2, 'uji t1');
  SELECT hpp_override INTO v_h FROM menu_hpp_pada(v_m, v_d2 - 1);
  IF v_h <> v_old THEN RAISE EXCEPTION 'GAGAL (c1): sehari sebelum = %, harap %', v_h, v_old; END IF;
  SELECT hpp_override INTO v_h FROM menu_hpp_pada(v_m, v_d2);
  IF v_h <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (c2): tanggal berlaku = %', v_h; END IF;
  SELECT hpp_override INTO v_h FROM menu_items WHERE id = v_m;
  IF v_h <> v_old + 1000 THEN RAISE EXCEPTION 'GAGAL (c3): menu_items = %', v_h; END IF;

  -- (d) per kunci: perubahan kanal hari ini tidak menghidupkan lagi override lama
  PERFORM ubah_hpp_menu(v_m, '{"ss_online": 5000}'::jsonb, v_hari_ini, NULL);
  SELECT hpp_override, channel_hpp INTO v_h, v_ch FROM menu_hpp_pada(v_m, v_hari_ini);
  IF v_h <> v_old + 1000 OR (v_ch->>'ss_online')::numeric <> 5000 THEN
    RAISE EXCEPTION 'GAGAL (d): override %, kanal %', v_h, v_ch; END IF;
  SELECT channel_hpp INTO v_ch FROM menu_hpp_pada(v_m, v_d2);
  IF v_ch ? 'ss_online' AND (v_ch->>'ss_online')::numeric = 5000 THEN RAISE EXCEPTION 'GAGAL (d2): kanal bocor mundur'; END IF;

  -- (e) koreksi pada tanggal sama = satu baris
  PERFORM ubah_hpp_menu(v_m, jsonb_build_object('hpp_override', v_old + 2000), v_d2, NULL);
  SELECT count(*) INTO v_n FROM menu_hpp_riwayat WHERE menu_item_id=v_m AND kunci='hpp_override' AND berlaku_mulai=v_d2;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (e): % baris', v_n; END IF;

  -- (f) kontrol negatif sebagai admin
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_hari_ini + 1, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f1): tanggal masa depan diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_batas - 1, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f2): tanggal sebelum batas diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": -5}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f3): nilai negatif diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": "abc"}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f4): teks diterima'; END IF;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN raise_exception THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f5): objek kosong diterima'; END IF;
  RESET ROLE;

  -- (g) crew & admin_finance ditolak 42501
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g1): crew diterima'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_af, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false; BEGIN PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 1}'::jsonb, v_hari_ini, NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g2): admin_finance diterima'; END IF;
  RESET ROLE;

  -- (h) trigger: tulis langsung → satu baris 'trigger' hari ini; jalur RPC tidak menghasilkan baris 'trigger'
  UPDATE menu_items SET hpp_override = v_old2 + 7 WHERE id = v_m2;
  SELECT count(*) INTO v_n FROM menu_hpp_riwayat
   WHERE menu_item_id=v_m2 AND kunci='hpp_override' AND berlaku_mulai=v_hari_ini AND sumber='trigger' AND nilai = v_old2 + 7;
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (h1): % baris trigger', v_n; END IF;
  SELECT count(*) INTO v_n FROM menu_hpp_riwayat WHERE menu_item_id=v_m AND sumber='trigger';
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (h2): RPC tercatat ganda lewat trigger (%)', v_n; END IF;

  -- (i) anon tak bisa membaca riwayat
  SET LOCAL ROLE anon;
  v_ok := false; BEGIN PERFORM count(*) FROM menu_hpp_riwayat;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): anon bisa membaca riwayat'; END IF;
  RESET ROLE;
END $$;
SELECT 'T1 LULUS' AS hasil;
ROLLBACK;
