-- Prediksi stockout per item per outlet (papan SPV, lintas outlet).
-- Laju pakai = rata-rata harian 'pemakaian' selama 7 hari terakhir.
-- days_left = saldo saat ini / laju harian. Memungkinkan peringatan DINI
-- ("akan habis ~6 jam") sebelum item menyentuh threshold — bukan setelahnya.
-- Mirror pola monitoring_view_spv: definer view (security_barrier) agar SPV
-- melihat semua outlet meski RLS ledger_stok dibatasi per-outlet.
CREATE OR REPLACE VIEW stockout_forecast_spv AS
WITH usage AS (
  SELECT
    outlet_id,
    bahan_baku_id,
    SUM(ABS(qty)) / 7.0 AS daily_rate
  FROM ledger_stok
  WHERE tipe = 'pemakaian'
    AND created_at >= NOW() - INTERVAL '7 days'
  GROUP BY outlet_id, bahan_baku_id
)
SELECT
  sb.outlet_id,
  o.name        AS outlet_name,
  sb.bahan_baku_id,
  b.nama        AS item_name,
  b.satuan,
  sb.saldo      AS current_qty,
  COALESCE(b.default_reorder_point, 10) AS threshold,
  u.daily_rate,
  sb.saldo / u.daily_rate AS days_left
FROM stok_balance sb
JOIN outlets o     ON sb.outlet_id = o.id
JOIN bahan_baku b  ON sb.bahan_baku_id = b.id
JOIN usage u       ON u.outlet_id = sb.outlet_id
                  AND u.bahan_baku_id = sb.bahan_baku_id
WHERE u.daily_rate > 0;

ALTER VIEW stockout_forecast_spv SET (security_barrier = on);
