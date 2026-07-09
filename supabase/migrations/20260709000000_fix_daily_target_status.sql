-- Update view daily_target_progress_spv agar menghitung omzet dari order dengan status completed, selesai, atau paid.
-- Sebelumnya hanya menghitung 'completed' yang mungkin menyebabkan omzet_today tidak sesuai atau seolah 0 (reset tapi gak terisi).

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
      AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
  ), 0)                                                                  AS omzet_today
FROM public.outlets o;

GRANT SELECT ON public.daily_target_progress_spv TO authenticated;

-- Perbarui daily_target_progress_scoped juga (hanya mendefinisikan ulang agar referensinya tetap benar jika ada dependensi)
CREATE OR REPLACE VIEW public.daily_target_progress_scoped AS
  SELECT * FROM public.daily_target_progress_spv
  WHERE outlet_id IN (SELECT public.accessible_outlet_ids());
GRANT SELECT ON public.daily_target_progress_scoped TO authenticated;
