-- Penanda order yang dibuat saat perangkat OFFLINE lalu disusulkan ke server.
-- Tidak bisa memakai `pos_client`: kolom itu menandai jenis klien (web vs native)
-- dan dipakai admin-dashboard monitoring untuk melaporkan outlet pakai POS apa,
-- jadi order native yang dibuat saat online tetap harus bernilai 'native'.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_offline_sync BOOLEAN NOT NULL DEFAULT false;
