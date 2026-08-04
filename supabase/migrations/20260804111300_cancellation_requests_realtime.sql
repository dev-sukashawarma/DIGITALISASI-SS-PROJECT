-- Aktifkan Supabase Realtime untuk tabel cancellation_requests agar update instan di Dashboard Manager
ALTER PUBLICATION supabase_realtime ADD TABLE cancellation_requests;
