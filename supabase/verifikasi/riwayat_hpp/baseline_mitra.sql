-- Komponen P&L mitra (get_mitra_orders_summary) per periode × channel_group.
-- Jalan utuh dalam satu panggilan CLI (~4-8 detik untuk kedua periode) —
-- tidak perlu dipecah per periode seperti baseline_owner.sql, dan tidak
-- perlu menaikkan statement_timeout (jauh di bawah default 2min).
WITH periode(nama, dari, sampai) AS (VALUES
  ('2026-08',        timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
  ('2026-09-01..24', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07')
)
SELECT p.nama AS periode, s.outlet_id, s.channel_group, s.cogs, s.gross_revenue, s.order_count
FROM periode p
CROSS JOIN LATERAL public.get_mitra_orders_summary(
  (SELECT array_agg(id) FROM public.outlets WHERE type = 'mitra'), p.dari, p.sampai) s
ORDER BY 1, 2, 3;
