-- M1: tandai alpha untuk staff aktif tanpa clock-in 'in' hari ini.
-- Dijalankan setiap hari pukul 23:55 (timezone UTC = 16:55 WIB).
CREATE OR REPLACE FUNCTION mark_alpha_for(target_date DATE)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status)
  SELECT
    gen_random_uuid(),
    s.id,
    s.outlet_id,
    'in',
    (target_date + TIME '23:59'),
    'alpha'
  FROM outlet_staff s
  WHERE s.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.outlet_staff_id = s.id
        AND a.type = 'in'
        AND a.ts_server::date = target_date
    );
$$;

SELECT cron.schedule(
  'mark-alpha',
  '55 23 * * *',
  $$ SELECT mark_alpha_for(CURRENT_DATE); $$
);

-- DOWN:
-- SELECT cron.unschedule('mark-alpha');
-- DROP FUNCTION IF EXISTS mark_alpha_for(DATE);
