-- 20260922090000_add_crew_trainee_subrole.sql
-- Update constraint sub_role pada outlet_staff untuk menambahkan 'crew_trainee'

ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_sub_role_check;

ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_sub_role_check
  CHECK (sub_role IS NULL OR sub_role IN ('crew_regular', 'crew_backup', 'crew_trainee'));
