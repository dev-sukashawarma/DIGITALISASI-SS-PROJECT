-- Migration: Add account_category column to outlet_staff table
-- Categories: 'employee', 'system_bot', 'kiosk', 'mitra_owner', 'testing'

-- 1. Tambah kolom account_category dengan default 'employee'
ALTER TABLE public.outlet_staff
  ADD COLUMN IF NOT EXISTS account_category TEXT NOT NULL DEFAULT 'employee';

-- 2. Tambah CHECK constraint untuk integritas data kategori
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlet_staff_account_category_check'
  ) THEN
    ALTER TABLE public.outlet_staff
      ADD CONSTRAINT outlet_staff_account_category_check
      CHECK (account_category IN ('employee', 'system_bot', 'kiosk', 'mitra_owner', 'testing'));
  END IF;
END $$;

-- 3. Index untuk performa filtering
CREATE INDEX IF NOT EXISTS idx_outlet_staff_account_category ON public.outlet_staff(account_category);

-- 4. Klasifikasi awal 177 akun yang sudah ada
-- A. system_bot (Dev AI, bot automation, developer system)
UPDATE public.outlet_staff
SET account_category = 'system_bot'
WHERE 
  username ILIKE 'devai_%' 
  OR name ILIKE 'devai%' 
  OR email ILIKE 'devai%'
  OR username ILIKE 'dev_%'
  OR email ILIKE 'dev_%'
  OR role = 'developer'
  OR username = 'admindev'
  OR name = 'admin dev'
  OR username = 'rendy';

-- B. kiosk (Perangkat Kiosk POS Outlet)
UPDATE public.outlet_staff
SET account_category = 'kiosk'
WHERE 
  role = 'kiosk'
  OR username IN ('outlet_dramaga', 'empang_', 'pusatt', 'tes_outlet');

-- C. mitra_owner (Investor / Pemilik Gerai Mitra)
UPDATE public.outlet_staff
SET account_category = 'mitra_owner'
WHERE 
  role = 'mitra'
  OR username ILIKE 'mitra_%';

-- D. testing (Akun Dummy / Testing / Dev Kasir)
UPDATE public.outlet_staff
SET account_category = 'testing'
WHERE 
  username IN (
    'tes', 'tes_bnr', 'kasir_tes', 'empang_tes', 'rendy_tes', 'pusat_tes',
    'owner_test', 'leader_test', 'kitchentest', 'testcicurug', 'testempang',
    'leader_baru', 'korlap1', 'fahmibnr'
  )
  OR name ILIKE '%test%'
  OR name ILIKE 'tes %'
  OR name IN (
    'test finance', 'test cicurug', 'test empang', 'test kitchen crew',
    'kitchen test', 'leader tes', 'leader suka shawarma', 'leader baru',
    'kasir paledang', 'tes', 'tes_bnr', 'kasir_tes', 'empang_tes', 'pusat_tes',
    'rendy_tes', 'superadmin 2', 'admin 2'
  )
  OR outlet_id = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';

-- 5. Reload cache PostgREST agar REST API segera mendeteksi kolom baru
NOTIFY pgrst, 'reload schema';
