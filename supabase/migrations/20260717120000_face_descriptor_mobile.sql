-- Kolom face recognition khusus mobile (Android native-superapp).
-- TERPISAH dari kolom web (face_descriptor, enrolled_at, ref_photo_url) karena
-- model TFLite Android tidak kompatibel dengan @vladmandic/human di apps/absensi web.
-- Kolom web TIDAK disentuh — absensi web masih produksi.
-- consent_at / consent_by existing DIPAKAI BERSAMA lintas platform (tidak dibuat baru).
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS face_descriptor_mobile real[],
  ADD COLUMN IF NOT EXISTS mobile_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS mobile_enrolled_by uuid,
  ADD COLUMN IF NOT EXISTS mobile_re_enroll_reason text,
  ADD COLUMN IF NOT EXISTS ref_photo_url_mobile text;
