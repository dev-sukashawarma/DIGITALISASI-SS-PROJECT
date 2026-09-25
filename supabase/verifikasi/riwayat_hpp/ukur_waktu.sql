CREATE TEMP TABLE IF NOT EXISTS _waktu_owner (percobaan int, ms numeric);
DO $$
DECLARE t0 timestamptz;
BEGIN
  FOR i IN 1..3 LOOP
    t0 := clock_timestamp();
    PERFORM public.get_owner_dashboard_summary(timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07');
    INSERT INTO _waktu_owner VALUES (i, round(EXTRACT(EPOCH FROM clock_timestamp() - t0) * 1000));
  END LOOP;
END $$;
SELECT percobaan, ms FROM _waktu_owner ORDER BY percobaan;
