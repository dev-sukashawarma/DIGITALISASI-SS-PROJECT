-- Snapshot total_cogs Owner Dashboard per periode × outlet. Dijalankan sebagai postgres
-- (auth.uid() NULL → akses penuh). Output deterministik agar bisa di-diff.
-- statement_timeout dinaikkan sesi ini saja (default 2min terlalu pendek untuk
-- ~40 pemanggilan get_owner_dashboard_summary berurutan; query murni SELECT read-only).
SET statement_timeout = '9min';
WITH periode(nama, dari, sampai) AS (VALUES
  ('2026-08',        timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
  ('2026-09-01..24', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07')
),
target AS (
  SELECT NULL::uuid AS outlet_id, '~SEMUA' AS outlet
  UNION ALL
  SELECT o.id, o.name || ' [' || o.id || ']' FROM public.outlets o
)
SELECT p.nama AS periode, t.outlet,
       public.get_owner_dashboard_summary(p.dari, p.sampai, t.outlet_id) ->> 'total_cogs' AS total_cogs
FROM periode p CROSS JOIN target t
ORDER BY 1, 2;
