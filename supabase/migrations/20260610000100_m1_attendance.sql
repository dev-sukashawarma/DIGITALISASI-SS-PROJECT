-- M1: catatan absensi (clock-in/out)
CREATE TABLE attendance (
  id              UUID PRIMARY KEY,                 -- digenerate client (idempotency)
  outlet_staff_id UUID NOT NULL REFERENCES outlet_staff(id) ON DELETE CASCADE,
  outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('in','out')),
  ts_server       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ts_client       TIMESTAMPTZ,
  gps_lat         NUMERIC,
  gps_lng         NUMERIC,
  distance_m      NUMERIC,
  match_distance  NUMERIC,
  selfie_url      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('tepat','telat','alpha')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_outlet_date ON attendance(outlet_id, ts_server);
CREATE INDEX idx_attendance_staff_date  ON attendance(outlet_staff_id, ts_server);

COMMENT ON COLUMN attendance.id IS 'UUID dari client; idempotency key untuk replay offline';
COMMENT ON COLUMN attendance.ts_client IS 'Waktu device saat absen; basis status telat bila absen offline';

-- DOWN:
-- DROP TABLE IF EXISTS attendance;
