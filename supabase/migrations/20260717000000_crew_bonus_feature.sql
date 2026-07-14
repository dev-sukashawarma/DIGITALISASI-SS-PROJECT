-- 20260717000000_crew_bonus_feature.sql
-- Migration script to add daily sales target bonus feature

-- 0. Create exec_sql helper function if it doesn't exist
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 1. Add bonus_amount column to public.daily_sales_targets
ALTER TABLE public.daily_sales_targets 
ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0);

-- 2. Implement public.resolve_daily_bonus(p_outlet UUID, p_date DATE) RETURNS NUMERIC
CREATE OR REPLACE FUNCTION public.resolve_daily_bonus(p_outlet UUID, p_date DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT bonus_amount FROM public.daily_sales_targets
       WHERE outlet_id = p_outlet AND effective_from <= p_date
       ORDER BY effective_from DESC, created_at DESC LIMIT 1),
    (SELECT bonus_amount FROM public.daily_sales_targets
       WHERE outlet_id IS NULL AND effective_from <= p_date
       ORDER BY effective_from DESC, created_at DESC LIMIT 1),
    0
  );
$$;

-- 3. Drop the old public.set_daily_target(p_outlet UUID, p_amount NUMERIC)
DROP FUNCTION IF EXISTS public.set_daily_target(UUID, NUMERIC);

-- Create the new public.set_daily_target(p_outlet UUID, p_amount NUMERIC, p_bonus NUMERIC DEFAULT 0)
CREATE OR REPLACE FUNCTION public.set_daily_target(p_outlet UUID, p_amount NUMERIC, p_bonus NUMERIC DEFAULT 0)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengatur target';
  END IF;
  INSERT INTO public.daily_sales_targets (outlet_id, target_amount, bonus_amount, created_by)
  VALUES (p_outlet, p_amount, p_bonus, auth.uid());
END;
$$;

-- 4. Drop the old public.get_current_targets()
DROP FUNCTION IF EXISTS public.get_current_targets();

-- Create the new public.get_current_targets() returning outlet_id, outlet_name, target_amount, bonus_amount, is_override
CREATE OR REPLACE FUNCTION public.get_current_targets()
RETURNS TABLE (
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  bonus_amount  NUMERIC,
  is_override   BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    public.resolve_daily_bonus(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    EXISTS (SELECT 1 FROM public.daily_sales_targets t WHERE t.outlet_id = o.id)
  FROM public.outlets o
  ORDER BY o.name;
$$;
