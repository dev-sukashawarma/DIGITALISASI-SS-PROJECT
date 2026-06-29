-- 20260629160000_system_health_views.sql
-- Ringkas konsumsi data dashboard System Health: alih-alih menarik SEMUA baris
-- 24 jam tiap 30 detik lalu di-reduce di browser, sediakan dua view.
--
-- PENTING: security_invoker = true agar RLS tabel (system_health_log: hanya
-- is_admin() yang boleh SELECT) TETAP berlaku ke pemanggil view. Tanpa ini view
-- akan jalan sebagai owner (definer) dan membocorkan data ke non-admin.

-- 1. Status terkini per target (untuk kartu Apps/Infra). Hanya ~beberapa baris.
CREATE OR REPLACE VIEW public.system_health_latest
WITH (security_invoker = true) AS
  SELECT DISTINCT ON (target_name)
    id, target_type, target_name, status, db_status,
    last_activity_at, response_time_ms, detail, checked_at
  FROM public.system_health_log
  ORDER BY target_name, checked_at DESC;

GRANT SELECT ON public.system_health_latest TO authenticated;

-- 2. Perubahan status (transisi) dalam 24 jam terakhir, dihitung server-side
--    via LAG() — untuk Riwayat Insiden. Payload = hanya baris transisi.
CREATE OR REPLACE VIEW public.system_health_transitions
WITH (security_invoker = true) AS
  WITH ordered AS (
    SELECT
      target_name, status, checked_at,
      LAG(status) OVER (PARTITION BY target_name ORDER BY checked_at) AS prev_status
    FROM public.system_health_log
    WHERE checked_at >= now() - interval '24 hours'
  )
  SELECT target_name, prev_status AS from_status, status AS to_status, checked_at
  FROM ordered
  WHERE prev_status IS NOT NULL AND prev_status <> status
  ORDER BY checked_at DESC;

GRANT SELECT ON public.system_health_transitions TO authenticated;
