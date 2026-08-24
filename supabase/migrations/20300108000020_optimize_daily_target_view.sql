-- Optimize view daily_target_progress_spv to use index-friendly date range condition
-- instead of casting created_at which causes sequential scans and DB timeouts.

CREATE OR REPLACE VIEW public.daily_target_progress_spv
WITH (security_barrier = true) AS
SELECT
  o.id                                                                   AS outlet_id,
  o.name                                                                 AS outlet_name,
  public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS target_amount,
  COALESCE((
    SELECT SUM(ord.total_amount)
    FROM public.orders ord
    WHERE ord.outlet_id = o.id
      AND ord.status IN ('completed', 'selesai', 'paid')
      AND ord.created_at >= ((now() AT TIME ZONE 'Asia/Jakarta')::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
      AND ord.created_at < (((now() AT TIME ZONE 'Asia/Jakarta')::date) + interval '1 day')::timestamp AT TIME ZONE 'Asia/Jakarta'
  ), 0)                                                                  AS omzet_today
FROM public.outlets o;

GRANT SELECT ON public.daily_target_progress_spv TO authenticated;

-- Ensure the scoped view is also updated (if it exists)
CREATE OR REPLACE VIEW public.daily_target_progress_scoped AS
  SELECT * FROM public.daily_target_progress_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
  
GRANT SELECT ON public.daily_target_progress_scoped TO authenticated;

-- Also notify postgrest
NOTIFY pgrst, 'reload schema';
