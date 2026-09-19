-- 20300223000000_sync_kantor_pusat_coordinates_to_bnr.sql
-- Menyelaraskan koordinat Kantor Pusat dengan Outlet BNR untuk keperluan absensi staf kantor pusat.

UPDATE public.outlets
SET 
  lat = -6.6290369,
  lng = 106.7979449,
  updated_at = NOW()
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
