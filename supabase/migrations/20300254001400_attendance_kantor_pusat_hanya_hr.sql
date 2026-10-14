-- Kehadiran Kantor Pusat hanya boleh dibaca HR, admin, dan developer.
--
-- Policy SELECT `attendance` yang lama bersifat PERMISSIVE dan saling menjumlah:
-- `accessible_outlet_ids()` memberi regional_manager seluruh outlet, dan area manager
-- yang outlet utamanya Kantor Pusat ikut mendapat outlet itu. Policy RESTRICTIVE di
-- bawah ini memotong semua jalur tersebut sekaligus untuk baris Kantor Pusat, tanpa
-- mengubah akses ke outlet lain.
--
-- Tetap boleh: pemilik baris (riwayat absen sendiri), dan service_role (bypass RLS).
-- Cermin native: ABSEN_KANTOR_PUSAT_ROLES di core/roles Role.kt.

CREATE OR REPLACE FUNCTION public.boleh_lihat_absen_kantor_pusat()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('admin', 'admin_hr', 'developer')
  );
$$;

REVOKE ALL ON FUNCTION public.boleh_lihat_absen_kantor_pusat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boleh_lihat_absen_kantor_pusat() TO authenticated;

DROP POLICY IF EXISTS attendance_kantor_pusat_hanya_hr ON public.attendance;
CREATE POLICY attendance_kantor_pusat_hanya_hr
  ON public.attendance
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    outlet_id IS DISTINCT FROM 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
    OR outlet_staff_id = (SELECT auth.uid())
    OR (SELECT public.boleh_lihat_absen_kantor_pusat())
  );
