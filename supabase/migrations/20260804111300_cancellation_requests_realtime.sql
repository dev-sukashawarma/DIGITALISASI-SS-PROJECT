-- Aktifkan Supabase Realtime untuk tabel cancellation_requests agar update instan di Dashboard Manager
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'cancellation_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cancellation_requests;
    END IF;
END $$;
