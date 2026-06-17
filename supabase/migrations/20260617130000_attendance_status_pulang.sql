-- Menambahkan status lebih_awal dan pulang_telat untuk absensi pulang
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('tepat', 'telat', 'alpha', 'lebih_awal', 'pulang_telat'));
