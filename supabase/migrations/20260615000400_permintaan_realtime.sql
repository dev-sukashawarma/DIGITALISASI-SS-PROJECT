-- Aktifkan realtime agar crew mendapat notif perubahan status.
ALTER PUBLICATION supabase_realtime ADD TABLE permintaan_bahan;
ALTER TABLE permintaan_bahan REPLICA IDENTITY FULL;
