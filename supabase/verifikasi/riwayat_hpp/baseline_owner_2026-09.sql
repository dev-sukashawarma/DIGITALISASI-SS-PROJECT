-- Bagian per-periode (1-24 September) dari query kanonik di baseline_owner.sql,
-- logikanya identik (CROSS JOIN target 31 outlet), hanya periode dipatok.
-- Dipanggil oleh jalankan_baseline.sh — jangan jalankan manual kecuali untuk
-- debug (lihat header baseline_owner.sql untuk alasan pemisahan per-periode).
WITH target AS (
  SELECT NULL::uuid AS outlet_id, '~SEMUA' AS outlet
  UNION ALL
  SELECT o.id, o.name || ' [' || o.id || ']' FROM public.outlets o
)
SELECT '2026-09-01..24' AS periode, t.outlet,
       public.get_owner_dashboard_summary(timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07', t.outlet_id) ->> 'total_cogs' AS total_cogs
FROM target t
ORDER BY 1, 2;
