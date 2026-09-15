-- supabase/migrations/20260915201000_pamulang_type_mitra.sql
-- Spec §5.2. MITRA PAMULANG (dibuat 2026-09-08) tercatat type='outlet'.
-- Konfirmasi owner 2026-09-15: "pamulang itu mitra".
-- JANGAN di-apply sebelum laporan dampak (Task 1 Step 3) disetujui owner.
BEGIN;
UPDATE public.outlets SET type = 'mitra'
 WHERE name = 'MITRA PAMULANG' AND type = 'outlet';
DO $$
BEGIN
  IF (SELECT type FROM outlets WHERE name='MITRA PAMULANG') <> 'mitra' THEN
    RAISE EXCEPTION 'ASERSI GAGAL: Pamulang belum mitra';
  END IF;
END $$;
COMMIT;
