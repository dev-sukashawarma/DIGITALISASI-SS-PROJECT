-- Kolom audit untuk re-enrollment wajah (SPV-driven).
-- Aditif murni: tidak mengubah/menghapus objek existing.
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS re_enrolled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS re_enrolled_by   uuid,
  ADD COLUMN IF NOT EXISTS re_enroll_reason text;

COMMENT ON COLUMN outlet_staff.re_enrolled_at   IS 'Waktu re-enroll wajah terakhir';
COMMENT ON COLUMN outlet_staff.re_enrolled_by   IS 'outlet_staff.id SPV/leader yang melakukan re-enroll';
COMMENT ON COLUMN outlet_staff.re_enroll_reason IS 'Alasan re-enroll (opsional)';
