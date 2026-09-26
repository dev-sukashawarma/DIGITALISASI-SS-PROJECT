-- supabase/verifikasi/riwayat_hpp/t4_nilai_lama_kosong.sql — harapan: 'T4 LULUS'
-- Regresi 26 Sep 2026: menu_hpp_pada versi 20300245000000 memakai COALESCE(riwayat, menu_items),
-- sehingga nilai lama yang KOSONG (NULL / kunci kanal belum ada) diisi angka HARI INI → HPP baru
-- bocor mundur ke tanggal sebelum berlaku_mulai. Aturan yang benar (spec §3.2): menu yang punya
-- riwayat HANYA memakai riwayat; menu_items dipakai hanya bila menu tak punya riwayat sama sekali.
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_m uuid; v_s uuid; v_ch jsonb; v_h numeric;
  v_d2 date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  -- menu dengan hpp_override lama NULL
  SELECT id INTO v_m FROM menu_items WHERE hpp_override IS NULL AND NOT COALESCE(is_package,false) ORDER BY id LIMIT 1;
  -- menu dengan channel_hpp lama kosong {}
  SELECT id INTO v_s FROM menu_items WHERE channel_hpp = '{}'::jsonb AND hpp_override > 0 ORDER BY id LIMIT 1;
  IF v_admin IS NULL OR v_m IS NULL OR v_s IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM ubah_hpp_menu(v_m, '{"hpp_override": 7546}'::jsonb, v_d2, 'uji t4');
  PERFORM ubah_hpp_menu(v_s, '{"ss_online": 4321}'::jsonb, v_d2, 'uji t4');
  RESET ROLE;

  -- (a) nilai lama NULL tetap NULL sebelum tanggal berlaku
  SELECT hpp_override INTO v_h FROM menu_hpp_pada(v_m, v_d2 - 1);
  IF v_h IS NOT NULL THEN RAISE EXCEPTION 'GAGAL (a): HPP sebelum berlaku = %, harap NULL', v_h; END IF;
  SELECT hpp_override INTO v_h FROM menu_hpp_pada(v_m, v_d2);
  IF v_h IS DISTINCT FROM 7546 THEN RAISE EXCEPTION 'GAGAL (a2): HPP tanggal berlaku = %', v_h; END IF;

  -- (b) kunci kanal yang baru ditambah tidak bocor mundur
  SELECT channel_hpp INTO v_ch FROM menu_hpp_pada(v_s, v_d2 - 1);
  IF v_ch ? 'ss_online' THEN RAISE EXCEPTION 'GAGAL (b): kunci kanal bocor mundur: %', v_ch; END IF;
  SELECT channel_hpp INTO v_ch FROM menu_hpp_pada(v_s, v_d2);
  IF (v_ch->>'ss_online')::numeric IS DISTINCT FROM 4321 THEN RAISE EXCEPTION 'GAGAL (b2): kanal tanggal berlaku = %', v_ch; END IF;

  -- (c) menu tanpa riwayat sama sekali tetap memakai menu_items
  DELETE FROM menu_hpp_riwayat WHERE menu_item_id = v_s;
  SELECT hpp_override, channel_hpp INTO v_h, v_ch FROM menu_hpp_pada(v_s, v_d2 - 1);
  IF v_h IS DISTINCT FROM (SELECT hpp_override FROM menu_items WHERE id = v_s)
     OR v_ch IS DISTINCT FROM (SELECT channel_hpp FROM menu_items WHERE id = v_s) THEN
    RAISE EXCEPTION 'GAGAL (c): menu tanpa riwayat tidak memakai menu_items';
  END IF;
END $$;
SELECT 'T4 LULUS' AS hasil;
ROLLBACK;
