-- Papan Pembukaan Outlet tanpa langkah "Jadwal absensi & checklist harian" dan
-- "Target harian" (keputusan owner 2026-11-13: tidak perlu di papan; keduanya
-- tetap diatur di halaman masing-masing setelah outlet buka).
-- Badan fungsi = 20261113110000 dikurangi dua langkah itu.

CREATE OR REPLACE FUNCTION public.status_persiapan_outlet(p_outlet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_langkah  jsonb := '[]'::jsonb;
  v_kosong   text[];
  v_am       text;
  v_leader   text;
  v_crew     int;
  v_enroll   int;
  v_sj       jsonb;
  v_sj_ok    boolean;
  v_opname   timestamptz;
  v_inv      boolean;
  v_profil   boolean;
  v_rab      date;
  v_wajib_ok boolean;
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(false);

  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan' USING ERRCODE = 'no_data_found';
  END IF;

  -- data_outlet
  v_kosong := array_remove(ARRAY[
    CASE WHEN btrim(coalesce(o.name,'')) = '' THEN 'nama' END,
    CASE WHEN btrim(coalesce(o.address,'')) = '' THEN 'alamat' END,
    CASE WHEN o.lat IS NULL OR o.lng IS NULL THEN 'titik peta' END,
    CASE WHEN o.open_hour IS NULL OR o.close_hour IS NULL THEN 'jam buka' END
  ], NULL);
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','data_outlet','label','Data outlet, peta, jam buka','penanggung_jawab','Admin',
    'wajib',true,'selesai',cardinality(v_kosong) = 0,
    'info', CASE WHEN cardinality(v_kosong) = 0 THEN NULL
                 ELSE 'Belum diisi: ' || array_to_string(v_kosong, ', ') END);

  -- am
  SELECT string_agg(DISTINCT s.name, ', ') INTO v_am
  FROM public.am_outlet_assignments a
  JOIN public.outlet_staff s ON s.id = a.staff_id
  WHERE a.outlet_id = p_outlet_id
    AND a.effective_from <= v_hari_ini
    AND (a.effective_to IS NULL OR a.effective_to >= v_hari_ini)
    AND s.role = 'area_manager' AND s.status = 'active';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','am','label','AM ditautkan','penanggung_jawab','Admin',
    'wajib',true,'selesai',v_am IS NOT NULL,'info',v_am);

  -- crew
  SELECT count(*), count(*) FILTER (WHERE s.enrolled_at IS NOT NULL OR s.mobile_enrolled_at IS NOT NULL)
    INTO v_crew, v_enroll
  FROM public.outlet_staff s
  WHERE s.outlet_id = p_outlet_id AND s.role = 'crew' AND s.status = 'active';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','crew','label','Crew terdaftar','penanggung_jawab','HR',
    'wajib',true,'selesai',v_crew >= 1,
    'info', v_crew || ' terdaftar, ' || v_enroll || ' enroll wajah');

  -- stok_awal
  SELECT jsonb_object_agg(status, n), bool_or(status IN ('diterima_sebagian','diterima_lengkap','selesai'))
    INTO v_sj, v_sj_ok
  FROM (SELECT status, count(*) n FROM public.surat_jalan
        WHERE outlet_id = p_outlet_id AND status <> 'dibatalkan' GROUP BY status) x;
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','stok_awal','label','Stok awal dikirim & diverifikasi','penanggung_jawab','Kitchen',
    'wajib',true,'selesai',coalesce(v_sj_ok,false),
    'info', CASE WHEN v_sj IS NULL THEN 'Belum ada surat jalan'
                 ELSE (SELECT string_agg(k || ': ' || v, ', ') FROM jsonb_each_text(v_sj) e(k, v)) END);

  -- opname_pertama
  SELECT max(coalesce(finalized_at, updated_at)) INTO v_opname
  FROM public.opname WHERE outlet_id = p_outlet_id AND status = 'finalized';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','opname_pertama','label','Opname pertama','penanggung_jawab','Leader',
    'wajib',true,'selesai',v_opname IS NOT NULL,
    'info', to_char(v_opname AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI'));

  -- grand_opening
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','grand_opening','label','Tanggal grand opening','penanggung_jawab','Admin',
    'wajib',true,'selesai',o.tanggal_grand_opening IS NOT NULL,
    'info', coalesce(to_char(o.tanggal_grand_opening, 'DD Mon YYYY'), 'Belum ditentukan'));

  IF o.type = 'mitra' THEN
    SELECT EXISTS (SELECT 1 FROM public.mitra_investments WHERE outlet_id = p_outlet_id) INTO v_inv;
    SELECT EXISTS (SELECT 1 FROM public.mitra_profiles WHERE p_outlet_id = ANY (outlet_ids)) INTO v_profil;
    v_langkah := v_langkah || jsonb_build_object(
      'kunci','mitra','label','Data investasi + akun mitra','penanggung_jawab','Admin',
      'wajib',true,'selesai',v_inv AND v_profil,
      'info', CASE WHEN v_inv AND v_profil THEN NULL
                   WHEN NOT v_inv AND NOT v_profil THEN 'Investasi dan akun mitra belum ada'
                   WHEN NOT v_inv THEN 'Data investasi belum ada'
                   ELSE 'Akun mitra belum ada' END);

    SELECT berlaku_sampai INTO v_rab FROM public.rab_outlet_otomatis WHERE outlet_id = p_outlet_id
    ORDER BY berlaku_sampai DESC LIMIT 1;
    v_langkah := v_langkah || jsonb_build_object(
      'kunci','masa_rab','label','Masa RAB','penanggung_jawab','Admin',
      'wajib',false,'selesai',v_rab IS NOT NULL,
      'info', CASE WHEN v_rab IS NULL THEN NULL ELSE 's.d. ' || to_char(v_rab, 'DD Mon YYYY') END);
  END IF;

  -- leader
  SELECT string_agg(DISTINCT s.name, ', ') INTO v_leader
  FROM public.staff_outlets so JOIN public.outlet_staff s ON s.id = so.staff_id
  WHERE so.outlet_id = p_outlet_id AND s.role = 'leader' AND s.status = 'active';
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','leader','label','Leader ditautkan','penanggung_jawab','Admin / HR',
    'wajib',false,'selesai',v_leader IS NOT NULL,'info',v_leader);

  SELECT bool_and((e->>'selesai')::boolean) INTO v_wajib_ok
  FROM jsonb_array_elements(v_langkah) e WHERE (e->>'wajib')::boolean;

  RETURN jsonb_build_object(
    'outlet_id', o.id,
    'nama', o.name,
    'jenis', o.type,
    'status', o.status,
    'tanggal_grand_opening', o.tanggal_grand_opening,
    'siap_go_live', o.status = 'pending' AND coalesce(v_wajib_ok, false),
    'langkah', v_langkah);
END;
$$;
REVOKE ALL ON FUNCTION public.status_persiapan_outlet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_persiapan_outlet(uuid) TO authenticated;
