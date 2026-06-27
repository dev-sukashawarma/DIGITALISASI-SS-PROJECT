-- ============================================================
-- Jadwalkan sync-pos-sales tiap 1 menit (near-realtime ingestion).
--
-- MASALAH: penjualan POS (paid+selesai) hidup di project "sistem order"
-- (qntuh…). Mereka baru masuk tabel public.orders DB Utama lewat Edge
-- Function `sync-pos-sales` yang PULL-based. Tanpa pemicu, fungsi tak pernah
-- jalan → order baru tak pernah sampai ke view SPV → dashboard owner kosong.
--
-- SOLUSI: pg_cron memanggil sync-pos-sales tiap menit. Digabung dengan
-- realtime invalidation di sisi UI (useSalesRealtime), order yang sudah
-- bayar+selesai muncul di papan owner < ~60 dtk, lalu angka naik seketika
-- (papan tak perlu disentuh).
--
-- Pola mengikuti 20260620121000_schedule_system_health_collector.sql
-- (vault secrets: project_url + service_role_key, net.http_post).
-- Idempoten: unschedule dulu bila sudah ada, lalu schedule ulang.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-pos-sales') THEN
    PERFORM cron.unschedule('sync-pos-sales');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-pos-sales',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/sync-pos-sales',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
-- DOWN: SELECT cron.unschedule('sync-pos-sales');
