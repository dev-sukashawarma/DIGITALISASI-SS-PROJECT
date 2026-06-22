-- supabase/migrations/20260620120000_create_system_health_log.sql

CREATE TABLE system_health_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('app', 'supabase', 'cpanel')),
  target_name TEXT NOT NULL CHECK (target_name IN (
    'stok', 'absensi', 'pos-kasir', 'distribusi', 'owner-dashboard',
    'supabase-db', 'cpanel-server'
  )),
  status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down', 'unconfigured')),
  db_status TEXT CHECK (db_status IN ('ok', 'error')),
  last_activity_at TIMESTAMPTZ,
  response_time_ms INT,
  detail JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_health_log_target_checked
  ON system_health_log (target_type, target_name, checked_at DESC);

ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;

-- Hanya admin yang boleh baca (super user monitoring). Reuse helper dari
-- 20260619160000_admin_read_all_staff.sql — sudah SECURITY DEFINER, hindari rekursi RLS.
CREATE POLICY system_health_log_admin_read
  ON system_health_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Insert hanya dari service role (collector Edge Function), yang bypass RLS secara default.
-- Policy ini menutup jalur insert untuk role authenticated biasa.
CREATE POLICY system_health_log_insert_denied
  ON system_health_log FOR INSERT
  TO authenticated
  WITH CHECK (false);
