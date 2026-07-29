-- Migration: Fix get_my_target_progress RPC to handle both 0 arguments and 1 argument (p_outlet_id)

DROP FUNCTION IF EXISTS public.get_my_target_progress(UUID);
DROP FUNCTION IF EXISTS public.get_my_target_progress();

-- 1. Version with parameter
CREATE OR REPLACE FUNCTION public.get_my_target_progress(p_outlet_id UUID)
RETURNS TABLE (
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  omzet_today   NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_outlet_id UUID := p_outlet_id;
BEGIN
  IF v_target_outlet_id IS NULL THEN
    SELECT s.outlet_id INTO v_target_outlet_id
    FROM public.outlet_staff s
    WHERE s.id = auth.uid();
  END IF;

  IF v_target_outlet_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.outlet_id, p.outlet_name, p.target_amount, p.omzet_today
    FROM public.daily_target_progress_spv p
    WHERE p.outlet_id = v_target_outlet_id;
  ELSE
    RETURN QUERY
    SELECT p.outlet_id, p.outlet_name, p.target_amount, p.omzet_today
    FROM public.daily_target_progress_spv p
    LIMIT 1;
  END IF;
END;
$$;

-- 2. Version without parameters (backward compatible)
CREATE OR REPLACE FUNCTION public.get_my_target_progress()
RETURNS TABLE (
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  omzet_today   NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.get_my_target_progress(NULL::UUID);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_target_progress(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_my_target_progress() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
