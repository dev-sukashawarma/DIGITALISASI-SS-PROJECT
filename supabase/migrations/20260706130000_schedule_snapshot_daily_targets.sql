-- ============================================================
-- Laporan Target Harian kosong: snapshot_daily_targets() (dibuat di
-- 20260704034400_historical_daily_targets.sql) TIDAK PERNAH dijadwalkan
-- (cron.schedule-nya cuma komentar). Jadi historical_daily_targets tidak
-- pernah terisi otomatis walau target harian outlet sudah ada & tercapai.
--
-- FIX:
-- 1. Ubah fungsi agar terima parameter tanggal (default current_date),
--    supaya bisa dipakai untuk backfill tanggal yang terlewat.
-- 2. Jadwalkan pg_cron harian 23:55 WIB (16:55 UTC) — pola sama seperti
--    20260627100000_schedule_sync_pos_sales.sql.
-- 3. Backfill hari-hari yang sudah lewat tapi belum ke-snapshot.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION snapshot_daily_targets(p_date date DEFAULT current_date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  ON CONFLICT (record_date, outlet_id)
  DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    omzet_achieved = EXCLUDED.omzet_achieved,
    achieved_pct = EXCLUDED.achieved_pct;
END;
$$;

-- Idempoten: unschedule dulu bila sudah ada, lalu schedule ulang.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-daily-targets') THEN
    PERFORM cron.unschedule('snapshot-daily-targets');
  END IF;
END $$;

SELECT cron.schedule(
  'snapshot-daily-targets',
  '55 16 * * *', -- 23:55 Asia/Jakarta (UTC+7)
  $$ SELECT snapshot_daily_targets(); $$
);

-- Backfill hari-hari yang sudah lewat sejak tabel historical_daily_targets
-- dibuat (2026-07-04) tapi belum pernah ter-snapshot karena cron belum ada.
DO $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT generate_series('2026-07-04'::date, (current_date - 1), '1 day'::interval)::date
  LOOP
    PERFORM snapshot_daily_targets(d);
  END LOOP;
END $$;

-- DOWN: SELECT cron.unschedule('snapshot-daily-targets');
