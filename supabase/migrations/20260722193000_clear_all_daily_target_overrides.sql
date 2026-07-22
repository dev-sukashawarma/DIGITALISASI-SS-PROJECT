-- 20260722193000_clear_all_daily_target_overrides.sql
-- Function to clear all per-outlet overrides so all outlets revert to following global target

CREATE OR REPLACE FUNCTION public.clear_all_daily_target_overrides()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh menghapus override target';
  END IF;

  DELETE FROM public.daily_sales_targets
  WHERE outlet_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_daily_target_overrides() TO authenticated;
