-- 20300108000022_mutasi_antar_outlet_realtime.sql
-- Aktifkan broadcast Supabase Realtime untuk mutasi antar outlet agar badge
-- notifikasi dan daftar mutasi dapat terupdate secara instan tanpa reload halaman.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mutasi_antar_outlet'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mutasi_antar_outlet;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mutasi_antar_outlet_item'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mutasi_antar_outlet_item;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL agar payload event UPDATE & DELETE menyertakan
-- seluruh kolom data lama, sehingga filter realtime (mis. outlet_asal_id, status)
-- dapat dievaluasi secara akurat oleh Supabase Realtime engine.
ALTER TABLE public.mutasi_antar_outlet REPLICA IDENTITY FULL;
ALTER TABLE public.mutasi_antar_outlet_item REPLICA IDENTITY FULL;
