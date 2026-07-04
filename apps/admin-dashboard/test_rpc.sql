CREATE OR REPLACE FUNCTION public.get_all_target_progress()
RETURNS TABLE (
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  omzet_today   NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT outlet_id, outlet_name, target_amount, omzet_today
  FROM public.daily_target_progress_scoped
  ORDER BY outlet_name;
$$;
