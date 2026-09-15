-- Pilihan dua shift per outlet (mis. BNR: 08:00–17:00 atau 13:00–22:00).
--
-- Bila outlet_attendance_config.pilih_shift_aktif = true, crew WAJIB memilih
-- shift sebelum absen masuk. Shift 1 = jam_masuk/jam_keluar yang sudah ada,
-- Shift 2 = shift2_jam_masuk/shift2_jam_keluar. Outlet lain tak berubah
-- (default false).
--
-- Jam shift yang dipilih dibekukan di baris attendance (shift_jam_masuk /
-- shift_jam_keluar), supaya absen pulang, papan, dan riwayat tetap menilai
-- terhadap shift orang itu sendiri walau pengaturan outlet diubah belakangan.
-- NULL = absen dari outlet satu-shift (perilaku lama).
--
-- Aditif murni. attendance ada di publication realtime → ADD COLUMN tanpa
-- default (tanpa rewrite) + lock_timeout agar tak menggantung di belakang
-- lock replikasi.

SET lock_timeout = '5s';

ALTER TABLE public.outlet_attendance_config
  ADD COLUMN IF NOT EXISTS pilih_shift_aktif boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shift2_jam_masuk  time,
  ADD COLUMN IF NOT EXISTS shift2_jam_keluar time;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oac_shift2_lengkap_bila_aktif'
  ) THEN
    ALTER TABLE public.outlet_attendance_config
      ADD CONSTRAINT oac_shift2_lengkap_bila_aktif
      CHECK (NOT pilih_shift_aktif OR (shift2_jam_masuk IS NOT NULL AND shift2_jam_keluar IS NOT NULL));
  END IF;
END $$;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS shift_jam_masuk  time,
  ADD COLUMN IF NOT EXISTS shift_jam_keluar time;

COMMENT ON COLUMN public.outlet_attendance_config.pilih_shift_aktif IS
  'true = crew wajib memilih Shift 1 (jam_masuk–jam_keluar) atau Shift 2 (shift2_*) sebelum absen masuk';
COMMENT ON COLUMN public.attendance.shift_jam_masuk IS
  'Jam masuk shift yang dipilih crew saat absen (NULL = outlet satu shift)';
