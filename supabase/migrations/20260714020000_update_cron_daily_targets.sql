-- ====================================================================
-- Mengubah jadwal cron job snapshot harian.
-- Sebelumnya hanya berjalan sekali sehari pada jam 23:55.
-- Jika komputer lokal mati pada jam tersebut, data akan terlewat.
-- Solusi: Jalankan setiap 15 menit, dan setiap kali jalan, lakukan
-- backfill untuk 7 hari terakhir menggunakan fungsi sync_missing_daily_targets.
-- ====================================================================

DO $$
BEGIN
  -- Hapus jadwal lama jika ada
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-daily-targets') THEN
    PERFORM cron.unschedule('snapshot-daily-targets');
  END IF;
END $$;

-- Buat jadwal baru setiap 15 menit
SELECT cron.schedule(
  'snapshot-daily-targets',
  '*/15 * * * *',
  $$ SELECT sync_missing_daily_targets((current_date - 7)::date, current_date::date); $$
);
