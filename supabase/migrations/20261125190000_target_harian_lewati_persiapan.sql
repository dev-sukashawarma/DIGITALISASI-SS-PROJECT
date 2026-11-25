-- Target harian: lewati outlet Persiapan (bug hunt 2026-11-25).
-- snapshot_daily_targets(date) hanya melewati outlet tutup, sehingga MITRA CONDET
-- (Persiapan) mendapat baris target Rp 5.000.000 per hari
-- yang muncul di riwayat Target Harian dengan capaian 0%.
-- Badan fungsi = definisi live (pg_get_functiondef) + syarat status/go_live_at.

CREATE OR REPLACE FUNCTION public.snapshot_daily_targets(p_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := p_date;
BEGIN
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
      AND effective_from <= v_today
    ORDER BY outlet_id, effective_from DESC, created_at DESC
  ) dst ON dst.outlet_id = o.id
  LEFT JOIN (
    -- Global target
    SELECT target_amount
    FROM public.daily_sales_targets
    WHERE outlet_id IS NULL
      AND effective_from <= v_today
    ORDER BY effective_from DESC, created_at DESC
    LIMIT 1
  ) dt_global ON true
  -- Outlet Persiapan (belum Go-Live) tidak punya target; outlet hasil wizard baru
  -- bertarget mulai tanggal Go-Live-nya (bug hunt 25 Nov).
  WHERE o.status IS DISTINCT FROM 'pending'
    AND (o.go_live_at IS NULL OR (o.go_live_at AT TIME ZONE 'Asia/Jakarta')::date <= v_today)
  -- Outlet tutup dilewati mulai hari sesudah tanggal tutupnya.
    AND (o.is_active IS NOT FALSE
         OR o.nonaktif_at IS NULL
         OR (o.nonaktif_at AT TIME ZONE 'Asia/Jakarta')::date >= v_today)
  ON CONFLICT (record_date, outlet_id)
  DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    omzet_achieved = EXCLUDED.omzet_achieved,
    achieved_pct = EXCLUDED.achieved_pct;
END;
$function$;

-- Bersihkan baris target yang terlanjur dibuat untuk outlet yang MASIH Persiapan.
-- Outlet yang sudah Go-Live tidak disentuh (barisnya sesudah Go-Live sah).
DELETE FROM public.historical_daily_targets h
USING public.outlets o
WHERE o.id = h.outlet_id
  AND o.status = 'pending';
