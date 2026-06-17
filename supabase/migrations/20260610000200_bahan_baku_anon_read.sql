-- Allow unauthenticated users to read bahan_baku (reference data)
create policy bahan_baku_read_anon
  on bahan_baku for select
  to anon
  using (is_active = true);


-- Merged from 20260610000200_m1_outlet_attendance_config.sql
-- M1: config jam kerja & radius GPS per outlet
CREATE TABLE outlet_attendance_config (
  outlet_id       UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  jam_masuk       TIME NOT NULL DEFAULT '09:00',
  toleransi_menit INT  NOT NULL DEFAULT 15,
  radius_m        INT  NOT NULL DEFAULT 100,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default untuk setiap outlet yang sudah ada
INSERT INTO outlet_attendance_config (outlet_id)
SELECT id FROM outlets
ON CONFLICT (outlet_id) DO NOTHING;

-- DOWN:
-- DROP TABLE IF EXISTS outlet_attendance_config;
