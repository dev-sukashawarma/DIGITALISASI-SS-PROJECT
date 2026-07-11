-- 20260711220000_korlap_outlet_staff_read_access.sql
-- Memberikan akses READ ke tabel outlet_staff bagi korlap dan finance,
-- sehingga mereka bisa melihat nama staff (karyawan) yang mengajukan petty cash.

-- Policy: Korlap dan Admin Finance (atau siapa saja yang bukan admin global tapi perlu lihat staf outlet yang bisa mereka akses)
CREATE POLICY outlet_staff_accessible_outlets_read
  ON public.outlet_staff FOR SELECT
  TO authenticated
  USING (
    outlet_id IN (SELECT public.accessible_outlet_ids())
  );
