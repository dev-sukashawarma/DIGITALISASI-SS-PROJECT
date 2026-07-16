-- Fix realtime untuk owner_messages:
-- Realtime mem-block broadcast ke kasir karena kasir tidak punya izin SELECT.
-- Izinkan SELECT ke semua authenticated users agar event realtime lolos,
-- filter sesungguhnya tetap dilakukan di dalam RPC get_my_active_messages.
DROP POLICY IF EXISTS owner_messages_read_auth ON public.owner_messages;
CREATE POLICY owner_messages_read_auth ON public.owner_messages
  FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'owner_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.owner_messages;
  END IF;
END $$;
