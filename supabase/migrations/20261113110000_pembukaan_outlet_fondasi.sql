-- Wizard Pembukaan Outlet — fondasi (Task 3).
-- Spec: docs/superpowers/specs/2026-11-13-wizard-pembukaan-outlet-design.md
--
-- 1. Kolom outlets: tanggal_grand_opening, go_live_at, go_live_by.
-- 2. Log outlet_pembukaan_log (tanpa FK ke outlets: catatan bertahan setelah outlet dihapus).
-- 3. pembukaan_outlet_cek_peran(): penjaga role yang dipakai semua RPC pembukaan.
-- 4. status_persiapan_outlet(): SATU-SATUNYA sumber checklist (papan & gerbang Go-Live).
-- 5. outlet_ids_terhitung() dinyatakan ulang dengan filter pending agar replay dari nol
--    tidak kalah oleh 20300132000000 (yang terurut sesudahnya dan tanpa filter itu).

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS tanggal_grand_opening date,
  ADD COLUMN IF NOT EXISTS go_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS go_live_by uuid;

CREATE TABLE IF NOT EXISTS public.outlet_pembukaan_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id   uuid NOT NULL,
  nama_outlet text NOT NULL,
  aksi        text NOT NULL CHECK (aksi IN ('dibuat','go_live','dinonaktifkan','dihapus')),
  alasan      text,
  detail      jsonb,
  pelaku      uuid,
  pelaku_nama text,
  dibuat_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outlet_pembukaan_log_outlet ON public.outlet_pembukaan_log (outlet_id, dibuat_at DESC);

ALTER TABLE public.outlet_pembukaan_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outlet_pembukaan_log FROM anon, authenticated;
GRANT SELECT ON public.outlet_pembukaan_log TO authenticated;
DROP POLICY IF EXISTS outlet_pembukaan_log_baca ON public.outlet_pembukaan_log;
CREATE POLICY outlet_pembukaan_log_baca ON public.outlet_pembukaan_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role IN ('admin','owner','developer')
  ));

-- Penjaga role: p_tulis = true → admin/developer; false → admin/owner/developer.
CREATE OR REPLACE FUNCTION public.pembukaan_outlet_cek_peran(p_tulis boolean)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role = ANY (CASE WHEN p_tulis THEN ARRAY['admin','developer']
                             ELSE ARRAY['admin','owner','developer'] END)
  ) THEN
    RAISE EXCEPTION 'Hanya % yang boleh mengelola pembukaan outlet',
      CASE WHEN p_tulis THEN 'admin/developer' ELSE 'admin/owner/developer' END
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pembukaan_outlet_cek_peran(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pembukaan_outlet_cek_peran(boolean) TO authenticated;

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
  v_absen    boolean;
  v_target   numeric;
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

  -- absensi
  SELECT EXISTS (SELECT 1 FROM public.outlet_attendance_config WHERE outlet_id = p_outlet_id) INTO v_absen;
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','absensi','label','Jadwal absensi & checklist harian','penanggung_jawab','Leader',
    'wajib',false,'selesai',v_absen,
    'info', CASE WHEN v_absen THEN NULL ELSE 'Masih bawaan pusat' END);

  -- target_harian
  SELECT target_amount INTO v_target FROM public.daily_sales_targets
  WHERE outlet_id = p_outlet_id ORDER BY effective_from DESC LIMIT 1;
  v_langkah := v_langkah || jsonb_build_object(
    'kunci','target_harian','label','Target harian','penanggung_jawab','Owner',
    'wajib',false,'selesai',v_target IS NOT NULL,
    'info', CASE WHEN v_target IS NULL THEN NULL ELSE 'Rp ' || to_char(v_target, 'FM999G999G999') END);

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

-- Badan disalin dari definisi live (pg_get_functiondef 2026-11-13), bukan dari berkas 2030.
CREATE OR REPLACE FUNCTION public.outlet_ids_terhitung()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id
  FROM public.outlets o
  WHERE o.id IN (SELECT public.accessible_outlet_ids())
    AND COALESCE(o.type, '') <> 'test'
    AND COALESCE(o.status, 'active') <> 'pending';
$function$;
