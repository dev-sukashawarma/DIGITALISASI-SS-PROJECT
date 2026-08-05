-- Original version of this migration assumed `outlet_staff.role` was backed by a
-- Postgres ENUM type ("staff_role"), which does not exist -- the column is plain
-- TEXT governed by a CHECK constraint (outlet_staff_role_check). That made this
-- migration fail on every db push attempt (SQLSTATE 42704, type does not exist),
-- silently blocking every migration queued after it, including the marketplace
-- outlets migration from 2026-08-05. Never applied to remote (confirmed via
-- `supabase migration list` before this fix), so rewriting in place is safe --
-- no drift, nothing to repair.
ALTER TABLE public.outlet_staff DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff ADD CONSTRAINT outlet_staff_role_check
  CHECK (role = ANY (ARRAY[
    'admin','admin_hr','owner','regional_manager','area_manager','spv','kitchen',
    'leader','crew','kiosk','mitra','staff_pusat','admin_finance','korlap','purchasing',
    'developer'
  ]));
