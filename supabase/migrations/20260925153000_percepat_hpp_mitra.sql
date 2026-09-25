-- Percepat HPP mitra per tanggal + kunci baris di ubah_hpp_menu.
-- Spec: docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md (§5.1)
--
-- (a) menu_hpp_pada: body/signature/volatility IDENTIK dengan 20260925150000, hanya TANPA
--     `SET search_path`. Opsi SET pada fungsi SQL memblokir inlining, sehingga tiap pemanggilan
--     dari plpgsql (get_mitra_item_hpp_base, 16 ribu kali per ringkasan mitra) mem-parse &
--     merencanakan ulang body-nya (~0,76 ms/panggil) → get_mitra_orders_summary 7,7–10 dtk,
--     melewati statement_timeout 8 dtk role authenticated. Semua rujukan sudah `public.`,
--     dan fungsi ini SECURITY INVOKER, jadi melepas search_path tidak mengubah hak akses.
--     CREATE OR REPLACE mempertahankan grant yang ada.
-- (b) ubah_hpp_menu: tambah kunci baris menu_items (FOR UPDATE) setelah cek keberadaan menu,
--     agar dua simpan bersamaan tidak membuat menu_items menyimpang dari riwayat.
--     Selebihnya byte-identik dengan 20260925150000 (dicek terhadap pg_get_functiondef live).
BEGIN;

CREATE OR REPLACE FUNCTION public.menu_hpp_pada(p_menu_item_id uuid, p_tanggal date DEFAULT NULL)
RETURNS TABLE (hpp_override numeric, channel_hpp jsonb)
LANGUAGE sql STABLE AS $$
  WITH tgl AS (SELECT COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS t),
  efektif AS (
    SELECT DISTINCT ON (r.kunci) r.kunci, r.nilai
    FROM public.menu_hpp_riwayat r, tgl
    WHERE r.menu_item_id = p_menu_item_id AND r.berlaku_mulai <= tgl.t
    ORDER BY r.kunci, r.berlaku_mulai DESC
  ),
  punya AS (
    SELECT EXISTS (SELECT 1 FROM public.menu_hpp_riwayat r WHERE r.menu_item_id = p_menu_item_id) AS ada
  )
  SELECT (SELECT e.nilai FROM efektif e WHERE e.kunci = 'hpp_override'),
         COALESCE((SELECT jsonb_object_agg(e.kunci, e.nilai) FROM efektif e
                   WHERE e.kunci <> 'hpp_override' AND e.nilai IS NOT NULL), '{}'::jsonb)
  FROM punya WHERE punya.ada
  UNION ALL
  SELECT m.hpp_override, m.channel_hpp
  FROM public.menu_items m, punya
  WHERE m.id = p_menu_item_id AND NOT punya.ada;
$$;
GRANT EXECUTE ON FUNCTION public.menu_hpp_pada(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ubah_hpp_menu(
  p_menu_item_id uuid, p_perubahan jsonb, p_berlaku_mulai date DEFAULT NULL, p_alasan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_tgl      date := COALESCE(p_berlaku_mulai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_batas    date;
  v_kunci    text;
  v_json     jsonb;
  v_nilai    numeric;
  v_hpp      numeric;
  v_ch       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.role IN ('owner', 'admin') AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengubah HPP menu' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = p_menu_item_id) THEN
    RAISE EXCEPTION 'Menu tidak ditemukan';
  END IF;
  PERFORM 1 FROM public.menu_items WHERE id = p_menu_item_id FOR UPDATE;
  IF p_perubahan IS NULL OR jsonb_typeof(p_perubahan) <> 'object' OR p_perubahan = '{}'::jsonb THEN
    RAISE EXCEPTION 'Perubahan HPP kosong';
  END IF;

  v_batas := CASE WHEN EXTRACT(DAY FROM v_hari_ini) <= 10
                  THEN (date_trunc('month', v_hari_ini) - INTERVAL '1 month')::date
                  ELSE date_trunc('month', v_hari_ini)::date END;
  IF v_tgl > v_hari_ini THEN
    RAISE EXCEPTION 'Tanggal berlaku % tidak boleh di masa depan', to_char(v_tgl, 'DD-MM-YYYY');
  END IF;
  IF v_tgl < v_batas THEN
    RAISE EXCEPTION 'Tanggal berlaku paling awal % (bulan lalu hanya bisa diubah sampai tanggal 10)',
      to_char(v_batas, 'DD-MM-YYYY');
  END IF;

  FOR v_kunci, v_json IN SELECT e.key, e.value FROM jsonb_each(p_perubahan) e LOOP
    IF btrim(v_kunci) = '' THEN
      RAISE EXCEPTION 'Kunci HPP kosong';
    END IF;
    IF jsonb_typeof(v_json) = 'null' THEN
      v_nilai := NULL;
    ELSIF jsonb_typeof(v_json) = 'number' THEN
      v_nilai := (v_json #>> '{}')::numeric;
    ELSE
      RAISE EXCEPTION 'Nilai HPP "%" harus angka atau null', v_kunci;
    END IF;
    IF v_nilai < 0 THEN
      RAISE EXCEPTION 'Nilai HPP "%" tidak boleh negatif', v_kunci;
    END IF;
    PERFORM public._hpp_catat(p_menu_item_id, v_kunci, v_nilai, v_tgl, 'layar', p_alasan);
  END LOOP;

  -- menu_items = angka yang berlaku HARI INI (perubahan mundur tak menimpa yang lebih baru)
  SELECT h.hpp_override, h.channel_hpp INTO v_hpp, v_ch FROM public.menu_hpp_pada(p_menu_item_id, v_hari_ini) h;
  PERFORM set_config('app.hpp_via_rpc', 'on', true);
  UPDATE public.menu_items SET hpp_override = v_hpp, channel_hpp = v_ch WHERE id = p_menu_item_id;
  PERFORM set_config('app.hpp_via_rpc', '', true);

  RETURN jsonb_build_object('hpp_override', v_hpp, 'channel_hpp', v_ch, 'berlaku_mulai', v_tgl);
END $$;
REVOKE ALL ON FUNCTION public.ubah_hpp_menu(uuid, jsonb, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubah_hpp_menu(uuid, jsonb, date, text) TO authenticated, service_role;

COMMIT;
