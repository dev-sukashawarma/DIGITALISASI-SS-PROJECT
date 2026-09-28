-- Migration: Set developer account_category to employee
-- Developer staff are active personnel/employees, not system bots.
-- Complies with postgres-best-practices: idempotent, indexed column filter, fast transaction.

UPDATE public.outlet_staff
SET account_category = 'employee'
WHERE role = 'developer';

-- Add index on role if not exists to optimize role-based filtering (Postgres Best Practice 1.1)
CREATE INDEX IF NOT EXISTS idx_outlet_staff_role ON public.outlet_staff(role);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
