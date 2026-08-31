-- 20260831090000_drop_stockout_forecast_view.sql
-- Hapus view stockout_forecast_spv yang sudah tidak digunakan di App Stok

DROP VIEW IF EXISTS public.stockout_forecast_spv CASCADE;
