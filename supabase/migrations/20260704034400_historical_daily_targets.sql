-- Add historical daily targets tracking
CREATE TABLE IF NOT EXISTS public.historical_daily_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  record_date date NOT NULL,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  target_amount numeric NOT NULL DEFAULT 0,
  omzet_achieved numeric NOT NULL DEFAULT 0,
  achieved_pct numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(record_date, outlet_id)
);

ALTER TABLE public.historical_daily_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
  ON public.historical_daily_targets FOR SELECT 
  TO authenticated 
  USING (true);

-- Function to snapshot the targets
-- This should be run just before midnight (e.g. 23:55)
CREATE OR REPLACE FUNCTION snapshot_daily_targets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today date := current_date;
BEGIN
  -- Insert snapshot of today's target vs omzet
  INSERT INTO public.historical_daily_targets (record_date, outlet_id, target_amount, omzet_achieved, achieved_pct)
  SELECT 
    v_today,
    o.id AS outlet_id,
    COALESCE(dst.target_amount, COALESCE(dt_global.target_amount, 0)) AS target_amount,
    COALESCE(sales.omzet_today, 0) AS omzet_achieved,
    CASE 
      WHEN COALESCE(dst.target_amount, COALESCE(dt_global.target_amount, 0)) > 0 THEN 
        (COALESCE(sales.omzet_today, 0) / COALESCE(dst.target_amount, COALESCE(dt_global.target_amount, 0))) * 100
      ELSE 0
    END AS achieved_pct
  FROM public.outlets o
  LEFT JOIN (
    SELECT 
      outlet_id, 
      SUM(total_amount) AS omzet_today
    FROM public.orders
    WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = v_today
      AND status IN ('completed', 'selesai', 'paid') 
    GROUP BY outlet_id
  ) sales ON sales.outlet_id = o.id
  LEFT JOIN (
    -- Override targets per outlet
    SELECT DISTINCT ON (outlet_id) outlet_id, target_amount
    FROM public.daily_sales_targets
    WHERE outlet_id IS NOT NULL
    ORDER BY outlet_id, effective_from DESC, created_at DESC
  ) dst ON dst.outlet_id = o.id
  LEFT JOIN (
    -- Global target
    SELECT target_amount
    FROM public.daily_sales_targets
    WHERE outlet_id IS NULL
    ORDER BY effective_from DESC, created_at DESC
    LIMIT 1
  ) dt_global ON true
  ON CONFLICT (record_date, outlet_id) 
  DO UPDATE SET 
    target_amount = EXCLUDED.target_amount,
    omzet_achieved = EXCLUDED.omzet_achieved,
    achieved_pct = EXCLUDED.achieved_pct;
END;
$$;

-- Note: To automate this, if you have pg_cron enabled on your Supabase project:
-- SELECT cron.schedule('snapshot-daily-targets', '55 23 * * *', 'SELECT snapshot_daily_targets();');
