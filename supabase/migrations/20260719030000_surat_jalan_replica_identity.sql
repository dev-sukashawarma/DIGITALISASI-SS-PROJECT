-- Realtime distribusi: agar event ter-filter outlet_id (dan DELETE) lolos,
-- surat_jalan butuh REPLICA IDENTITY FULL. Publication sudah permisif
-- (enable_realtime_all), jadi cukup set replica identity. Aditif & idempotent.
DO $$
BEGIN
  IF to_regclass('public.surat_jalan') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.surat_jalan REPLICA IDENTITY FULL';
  END IF;
END $$;
