-- Waktu get_mitra_orders_summary semua outlet mitra (Agustus & 1–24 Sep), 2 percobaan tiap periode.
CREATE TEMP TABLE IF NOT EXISTS _waktu_mitra (periode text, percobaan int, ms numeric);
DO $$
DECLARE t0 timestamptz; v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.outlets WHERE type = 'mitra';
  FOR i IN 1..2 LOOP
    t0 := clock_timestamp();
    PERFORM * FROM public.get_mitra_orders_summary(v_ids, timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07');
    INSERT INTO _waktu_mitra VALUES ('2026-08', i, round(EXTRACT(EPOCH FROM clock_timestamp() - t0) * 1000));
    t0 := clock_timestamp();
    PERFORM * FROM public.get_mitra_orders_summary(v_ids, timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07');
    INSERT INTO _waktu_mitra VALUES ('2026-09-01..24', i, round(EXTRACT(EPOCH FROM clock_timestamp() - t0) * 1000));
  END LOOP;
END $$;
SELECT periode, percobaan, ms FROM _waktu_mitra ORDER BY periode, percobaan;
