-- 20260711100000_finance_role_admin_finance.sql
-- M5 Finance: role baru 'admin_finance' (maker treasury). Owner = checker.
-- Pola sama seperti add_mitra_role / add_staff_pusat_role.

-- 1. Perluas CHECK constraint outlet_staff.role — sertakan SEMUA role valid + admin_finance
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'leader',
    'crew', 'kiosk', 'kitchen', 'mitra', 'staff_pusat', 'admin_finance'
  ));

-- 2. admin_finance melihat semua outlet (data pusat). Tambah ke cabang "semua outlet".
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'admin_finance')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$$;

-- DOWN: hapus 'admin_finance' dari constraint & accessible_outlet_ids (kembali ke state sebelumnya).
