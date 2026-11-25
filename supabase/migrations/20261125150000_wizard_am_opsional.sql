-- Wizard Pembukaan Outlet: Area Manager boleh dikosongkan saat outlet dibuat
-- (keputusan owner 2026-11-25: "pilihan AM bisa nanti aja"). Langkah "AM ditautkan"
-- di papan tetap WAJIB, jadi Go-Live normal tetap menunggu AM ditautkan di HR
-- (atau lewat Go-Live paksa dengan alasan).
-- Badan fungsi = definisi live (pg_get_functiondef) dengan dua blok AM diubah.

CREATE OR REPLACE FUNCTION public.buat_outlet_persiapan(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id       uuid;
  v_jenis    text := p->>'jenis';
  v_nama     text := btrim(coalesce(p->>'nama', ''));
  v_am       uuid := nullif(p->>'am_staff_id', '')::uuid;
  v_leader   uuid := nullif(p->>'leader_staff_id', '')::uuid;
  v_go       date := nullif(p->>'tanggal_grand_opening', '')::date;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_mitra    jsonb := p->'mitra';
  v_rab      jsonb := p->'rab';
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);

  IF v_jenis NOT IN ('internal', 'mitra') OR v_jenis IS NULL THEN
    RAISE EXCEPTION 'Jenis outlet harus Internal atau Mitra';
  END IF;
  IF v_nama = '' THEN
    RAISE EXCEPTION 'Nama outlet wajib diisi';
  END IF;
  -- AM boleh kosong saat outlet dibuat (owner 25 Nov 2026); papan tetap
  -- menahan Go-Live sampai AM ditautkan di HR.
  IF v_am IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff WHERE id = v_am AND role = 'area_manager' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'AM yang dipilih bukan staf Area Manager yang aktif';
  END IF;
  IF v_leader IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff WHERE id = v_leader AND role = 'leader' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Leader yang dipilih bukan staf Leader yang aktif';
  END IF;
  IF v_go IS NOT NULL AND v_go < v_hari_ini THEN
    RAISE EXCEPTION 'Tanggal grand opening tidak boleh sebelum hari ini';
  END IF;
  IF v_jenis = 'internal' AND (jsonb_typeof(v_mitra) = 'object' OR jsonb_typeof(v_rab) = 'object') THEN
    RAISE EXCEPTION 'Data mitra dan masa RAB hanya untuk outlet berjenis Mitra';
  END IF;
  IF v_jenis = 'mitra' AND jsonb_typeof(v_mitra) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Data investasi mitra wajib diisi untuk outlet Mitra';
  END IF;

  INSERT INTO public.outlets (name, type, status, address, lat, lng, phone, region,
                              open_hour, close_hour, tanggal_grand_opening)
  VALUES (v_nama, v_jenis, 'pending',
          nullif(btrim(coalesce(p->>'alamat', '')), ''),
          nullif(p->>'lat', '')::numeric, nullif(p->>'lng', '')::numeric,
          nullif(btrim(coalesce(p->>'telepon', '')), ''),
          nullif(btrim(coalesce(p->>'region', '')), ''),
          coalesce(nullif(p->>'jam_buka', '')::time, '14:00'),
          coalesce(nullif(p->>'jam_tutup', '')::time, '22:00'),
          v_go)
  RETURNING id INTO v_id;

  IF v_am IS NOT NULL THEN
    INSERT INTO public.staff_outlets (staff_id, outlet_id) VALUES (v_am, v_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, reason, created_by)
    VALUES (v_am, v_id, v_hari_ini, 'Pembukaan outlet', auth.uid());
  END IF;
  IF v_leader IS NOT NULL THEN
    INSERT INTO public.staff_outlets (staff_id, outlet_id) VALUES (v_leader, v_id) ON CONFLICT DO NOTHING;
  END IF;

  IF v_jenis = 'mitra' THEN
    INSERT INTO public.mitra_investments (outlet_id, nilai_investasi, tanggal_mulai,
                                          persentase_bagi_hasil, management_fee, is_profit_sharing_active)
    VALUES (v_id,
            coalesce((v_mitra->>'nilai_investasi')::numeric, 0),
            coalesce(v_go, v_hari_ini),
            coalesce((v_mitra->>'persentase_bagi_hasil')::int, 100),
            coalesce((v_mitra->>'management_fee')::numeric, 3),
            true);
    IF nullif(v_mitra->>'mitra_user_id', '') IS NOT NULL THEN
      PERFORM public.tautkan_akun_mitra_outlet(v_id, (v_mitra->>'mitra_user_id')::uuid,
                                               coalesce(v_mitra->>'nama_mitra', v_nama));
    END IF;
    IF jsonb_typeof(v_rab) = 'object' THEN
      PERFORM public.simpan_masa_rab_outlet(
        v_id, (v_rab->>'berlaku_sampai')::date,
        ARRAY(SELECT jsonb_array_elements_text(coalesce(v_rab->'kategori_kecuali', '[]'::jsonb))));
    END IF;
  END IF;

  PERFORM public._pembukaan_outlet_log(v_id, v_nama, 'dibuat', NULL,
    jsonb_build_object('jenis', v_jenis, 'tanggal_grand_opening', v_go));
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.buat_outlet_persiapan(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buat_outlet_persiapan(jsonb) TO authenticated;
