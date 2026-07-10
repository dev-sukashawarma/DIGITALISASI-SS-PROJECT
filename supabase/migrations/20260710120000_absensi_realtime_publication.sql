-- 20260710120000_absensi_realtime_publication.sql
-- Absensi realtime: tambahkan tabel ke publication supabase_realtime + REPLICA IDENTITY FULL.
-- Idempotent & aditif. attendance + daily_checklist_ticks sudah ditambahkan di migration lama.

-- 1) Tambah ke publication (skip kalau sudah ada / tabel belum ada)
-- Catatan: global_settings, checklist_items, checklist_categories ditambah TANPA
-- REPLICA IDENTITY FULL (lihat blok 2) karena pemakaian realtime saat ini
-- unfiltered/UPDATE-only. Kalau nanti ada subscription berfilter atau butuh
-- DELETE-sensitive pada tabel-tabel ini, tambahkan juga ke REPLICA IDENTITY FULL.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'leave_requests','cash_advances',
    'outlet_staff','outlet_attendance_config','global_settings',
    'daily_checklist_records','checklist_items','checklist_categories'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) REPLICA IDENTITY FULL agar DELETE & UPDATE ber-filter membawa baris lama (lolos filter + RLS)
-- Catatan: outlet_staff sengaja FULL meski berisi kolom sensitif (face_descriptor) —
-- ini streaming seluruh baris lama saat UPDATE/DELETE, tapi diperlukan agar event
-- DELETE berfilter ("staff hilang") tetap membawa outlet_id untuk lolos filter client.
-- RLS tetap membatasi pengiriman event hanya ke koneksi yang berhak (defense tetap ada).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attendance','leave_requests','cash_advances',
    'outlet_staff','daily_checklist_ticks','daily_checklist_records','outlet_attendance_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;
