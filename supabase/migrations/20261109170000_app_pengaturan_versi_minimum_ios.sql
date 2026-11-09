-- Versi minimum aplikasi pelanggan iOS (paksa update), padanan
-- versi_minimum_android. Nomor build kedua platform TIDAK sejajar
-- (Android versionCode vs iOS CFBundleVersion), jadi kolom terpisah.
-- Bawaan 1 = tidak memaksa siapa pun. Dibaca gateway GET /api/v1/config.
ALTER TABLE public.app_pengaturan
  ADD COLUMN IF NOT EXISTS versi_minimum_ios int NOT NULL DEFAULT 1
  CHECK (versi_minimum_ios >= 1);
