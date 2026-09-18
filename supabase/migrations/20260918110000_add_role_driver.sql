-- 20260918110000_add_role_driver.sql
-- 1. Tambahkan role 'driver' ke constraint outlet_staff_role_check
-- 2. Update role Adam Sandy Rakhman menjadi 'driver'
-- 3. Koreksi record absensi masuk Adam hari ini (2026-09-18) ke Shift 3 (09:00 - 18:00)

SET lock_timeout = '5s';

ALTER TABLE public.outlet_staff DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff ADD CONSTRAINT outlet_staff_role_check
  CHECK (role = ANY (ARRAY[
    'admin','admin_hr','owner','regional_manager','area_manager','spv','kitchen',
    'leader','crew','kiosk','mitra','staff_pusat','admin_finance','korlap','purchasing',
    'developer', 'driver'
  ]));

-- Update role Adam Sandy Rakhman menjadi driver
UPDATE public.outlet_staff
SET role = 'driver', updated_at = NOW()
WHERE id = '02a653e1-8a01-4e90-a61f-c00ce69d0b5e';

-- Koreksi absensi masuk Adam Sandy Rakhman hari ini (2026-09-18) ke Shift 3 (09:00 - 18:00)
UPDATE public.attendance
SET 
  shift_jam_masuk = '09:00:00',
  shift_jam_keluar = '18:00:00',
  telat_menit = 26
WHERE outlet_staff_id = '02a653e1-8a01-4e90-a61f-c00ce69d0b5e'
  AND type = 'in'
  AND ts_server >= '2026-09-18T00:00:00+07:00';
