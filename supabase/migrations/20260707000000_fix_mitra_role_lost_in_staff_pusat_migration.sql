-- 20260707000000_fix_mitra_role_lost_in_staff_pusat_migration.sql
-- BUG FIX: migration 20260629110000_add_staff_pusat_role.sql secara tidak sengaja
-- menghapus 'mitra' dari CHECK constraint outlet_staff.role ketika menambahkan
-- 'staff_pusat'. Constraint yang seharusnya adalah gabungan keduanya.
--
-- Dampak: user dengan role 'mitra' tidak bisa di-INSERT (constraint violation).
-- Jika ada user mitra yang sudah ter-insert sebelumnya, mereka masih ada di DB
-- tapi constraint saat ini memblok INSERT baru.
--
-- Fix ini juga memperbaiki accessible_outlet_ids() yang kehilangan 'mitra'
-- di clause WHERE pada migration yang sama.

-- 1. Perbaiki CHECK constraint — sertakan SEMUA role yang valid
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN (
    'admin',
    'admin_hr',
    'owner',
    'spv',
    'leader',
    'crew',
    'kiosk',
    'kitchen',
    'mitra',
    'staff_pusat'
  ));

-- 2. Perbaiki accessible_outlet_ids() — pulihkan 'mitra' di clause single-outlet
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  -- admin/admin_hr/owner/spv/kitchen → semua outlet
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen')
  UNION
  -- leader → outlet yang dipetakan di staff_outlets
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  -- crew/kiosk/mitra/staff_pusat → outlet_id home saja
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$$;

-- DOWN:
-- Tidak perlu down migration — reverting ke state broken tidak ada gunanya.
-- Jika ingin rollback, hapus 'mitra' dari constraint dan accessible_outlet_ids()
-- (tapi ini berarti kembali ke bug).
