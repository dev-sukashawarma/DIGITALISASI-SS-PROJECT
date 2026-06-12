-- M1: kolom consent & enrollment wajah (additive, UU PDP)
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS consent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_by  UUID REFERENCES outlet_staff(id),
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;

COMMENT ON COLUMN outlet_staff.consent_at IS 'Waktu staff menyetujui pemrosesan data biometrik';
COMMENT ON COLUMN outlet_staff.consent_by IS 'SPV/kepala_outlet yang melakukan enroll';
COMMENT ON COLUMN outlet_staff.enrolled_at IS 'Waktu descriptor wajah tersimpan';

-- DOWN:
-- ALTER TABLE outlet_staff
--   DROP COLUMN IF EXISTS consent_at,
--   DROP COLUMN IF EXISTS consent_by,
--   DROP COLUMN IF EXISTS enrolled_at;
