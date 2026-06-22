-- supabase/migrations/20260620121000_schedule_system_health_collector.sql

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'system-health-collector',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/system-health-collector',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
-- DOWN: SELECT cron.unschedule('system-health-collector');
