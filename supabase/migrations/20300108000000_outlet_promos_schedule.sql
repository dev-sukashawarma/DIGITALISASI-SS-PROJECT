-- Promo terjadwal untuk outlet_promos.
--
-- Sebelumnya promo hanya punya `end_date` (batas akhir); promo baru selalu
-- langsung berlaku begitu `is_active` dinyalakan. Kolom `start_date` membuat
-- promo bisa dijadwalkan mulai kapan.
--
-- Backward compatible: start_date NULL = berlaku sejak diaktifkan (perilaku lama).
--
-- Zona waktu: kolom bertipe timestamptz — nilainya instant absolut (UTC di
-- dalam), jadi perbandingan "sudah mulai / sudah lewat" tidak pernah ambigu
-- meski perangkat kasir diset WITA/WIT. Rendering ke WIB dilakukan oleh DB
-- (timezone database di bawah) dan oleh helper WIB di frontend.

ALTER TABLE public.outlet_promos
  ADD COLUMN IF NOT EXISTS start_date timestamptz;

COMMENT ON COLUMN public.outlet_promos.start_date IS
  'Waktu mulai promo. NULL = berlaku sejak is_active dinyalakan.';
COMMENT ON COLUMN public.outlet_promos.end_date IS
  'Waktu berakhir promo. NULL = tanpa batas waktu.';

-- Jendela jadwal harus masuk akal. Baris lama (start_date NULL) tetap lolos.
ALTER TABLE public.outlet_promos
  DROP CONSTRAINT IF EXISTS outlet_promos_schedule_window_check;
ALTER TABLE public.outlet_promos
  ADD CONSTRAINT outlet_promos_schedule_window_check
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date > start_date);

-- Kasir mengambil promo per outlet yang aktif; jadwal ikut kolom filter.
CREATE INDEX IF NOT EXISTS idx_outlet_promos_outlet_active_window
  ON public.outlet_promos (outlet_id, is_active, start_date, end_date);

-- Tegaskan zona waktu database = Asia/Jakarta (WIB), supaya nilai timestamptz
-- dirender +07:00 di semua klien SQL/PostgREST. Saat migration ini ditulis DB
-- memang sudah +07:00; blok ini menjadikannya eksplisit, bukan kebetulan.
-- Di-guard: kalau role tak berwenang, migration tidak ikut gagal.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Jakarta');
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Lewati ALTER DATABASE SET timezone: role tidak berwenang.';
END $$;
