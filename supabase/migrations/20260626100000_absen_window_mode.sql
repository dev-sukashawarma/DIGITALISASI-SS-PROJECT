-- Tambah kolom mode absensi per outlet:
--   'auto'   = time window otomatis (1 jam sebelum masuk, 30 mnt sebelum pulang)
--   'manual' = SPV toggle is_active secara manual (perilaku lama)
ALTER TABLE outlet_attendance_config
  ADD COLUMN IF NOT EXISTS absen_window_mode text NOT NULL DEFAULT 'auto'
  CHECK (absen_window_mode IN ('auto', 'manual'));
