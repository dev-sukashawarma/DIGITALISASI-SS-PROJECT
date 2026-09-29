-- Hari Minggu & tanggal merah hanya membebaskan alfa untuk ROLE KANTOR.
-- Keputusan owner 2026-09-29: libur otomatis berlaku untuk staff_pusat, developer,
-- admin_hr, finance (admin_finance/finance) dan purchasing. Crew & staf outlet lain
-- tetap wajib masuk di hari Minggu/tanggal merah (outlet beroperasi normal).
--
-- Daftar role disimpan di global_settings `hr.role_libur_kantor` (jsonb array) supaya
-- bisa diubah dari halaman Hari Libur tanpa ubah kode. Perubahan pengaturan memicu
-- hitung ulang otomatis (trigger sempit, hanya untuk key itu).

CREATE OR REPLACE FUNCTION public.hr_role_libur_kantor()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT array_agg(x) FROM global_settings g, jsonb_array_elements_text(g.value) x
      WHERE g.key = 'hr.role_libur_kantor' AND jsonb_typeof(g.value) = 'array'),
    ARRAY['staff_pusat', 'developer', 'admin_hr', 'admin_finance', 'finance', 'purchasing']);
$$;
REVOKE ALL ON FUNCTION public.hr_role_libur_kantor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_role_libur_kantor() TO authenticated;

INSERT INTO global_settings (key, value, updated_at)
VALUES ('hr.role_libur_kantor',
        '["staff_pusat","developer","admin_hr","admin_finance","finance","purchasing"]'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hr_hitung_status_nonabsen(p_tgl date, p_staff uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hari_ini   date    := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_libur      boolean := NOT hr_hari_kerja(p_tgl);   -- Minggu / tanggal merah aktif
  v_role_libur text[]  := hr_role_libur_kantor();
  v_n integer;
BEGIN
  DELETE FROM attendance_harian h
  WHERE h.tgl = p_tgl AND h.sumber <> 'absen'
    AND (p_staff IS NULL OR h.staff_id = p_staff);

  INSERT INTO attendance_harian AS h (
    staff_id, outlet_id, tgl, status, sumber, keterangan, leave_id, updated_at
  )
  SELECT s.id, s.outlet_id, p_tgl,
         CASE WHEN l.id IS NOT NULL THEN hr_jenis_izin(l.leave_type) ELSE 'alfa' END,
         CASE WHEN l.id IS NOT NULL THEN 'cuti' ELSE 'alfa' END,
         CASE WHEN l.id IS NOT NULL
              THEN NULLIF(btrim(COALESCE(l.reason, '')), '')
              ELSE 'Tidak hadir tanpa keterangan' END,
         l.id,
         now()
  FROM outlet_staff s
  LEFT JOIN LATERAL (
    SELECT lr.id, lr.leave_type, lr.reason
    FROM leave_requests lr
    WHERE lr.staff_id = s.id AND lr.status = 'approved'
      AND p_tgl BETWEEN lr.start_date AND lr.end_date
    ORDER BY lr.approved_at DESC NULLS LAST, lr.created_at DESC
    LIMIT 1
  ) l ON true
  WHERE (p_staff IS NULL OR s.id = p_staff)
    AND s.outlet_id IS NOT NULL
    AND COALESCE(s.account_category, 'employee') = 'employee'
    AND s.role NOT IN ('kiosk', 'mitra', 'owner')
    -- Minggu/tanggal merah hanya libur bagi role kantor; outlet tetap hari kerja
    AND (NOT v_libur OR s.role <> ALL (v_role_libur))
    AND (s.status = 'active' OR (s.resign_date IS NOT NULL AND p_tgl <= s.resign_date))
    AND (s.resign_date IS NULL OR p_tgl <= s.resign_date)
    AND p_tgl >= GREATEST(
          COALESCE(s.join_date, (s.created_at AT TIME ZONE 'Asia/Jakarta')::date),
          (s.created_at AT TIME ZONE 'Asia/Jakarta')::date)
    AND NOT EXISTS (
      SELECT 1 FROM attendance_harian a
      WHERE a.staff_id = s.id AND a.tgl = p_tgl AND a.sumber = 'absen'
    )
    AND (l.id IS NOT NULL OR (
          p_tgl < v_hari_ini
          AND p_tgl >= hr_alfa_mulai()
          AND EXISTS (
            SELECT 1 FROM attendance_harian f
            WHERE f.staff_id = s.id AND f.sumber = 'absen' AND f.tgl <= p_tgl
          )))
  ON CONFLICT (staff_id, outlet_id, tgl) DO NOTHING;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Pengaturan role berubah → hitung ulang seluruh periode pelacakan
CREATE OR REPLACE FUNCTION public.trg_role_libur_kantor_ubah()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM hr_hitung_status_rentang(hr_alfa_mulai(),
    GREATEST(hr_alfa_mulai(), (now() AT TIME ZONE 'Asia/Jakarta')::date));
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.trg_role_libur_kantor_ubah() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_role_libur_kantor_ubah ON public.global_settings;
CREATE TRIGGER trg_role_libur_kantor_ubah
  AFTER INSERT OR UPDATE OF value ON public.global_settings
  FOR EACH ROW WHEN (NEW.key = 'hr.role_libur_kantor')
  EXECUTE FUNCTION public.trg_role_libur_kantor_ubah();

-- Terapkan ke data yang sudah ada
SELECT public.hr_hitung_status_rentang(public.hr_alfa_mulai(),
  GREATEST(public.hr_alfa_mulai(), (now() AT TIME ZONE 'Asia/Jakarta')::date));
