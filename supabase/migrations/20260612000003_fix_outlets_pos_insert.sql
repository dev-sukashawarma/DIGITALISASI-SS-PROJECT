-- 20260612000003_fix_outlets_pos_insert.sql
-- Fix: POS admin "Tambah Cabang" gagal (HTTP 400) saat INSERT ke outlets.
--
-- Akar masalah: tabel `outlets` dirancang untuk di-sync dari Ecosystem, sehingga
-- kolom id/slug/lat/lng = NOT NULL TANPA default. POS hanya mengirim
-- name/address/phone/is_active/inactive_reason -> NOT NULL violation -> 400.
--
-- Tabel ini sekarang dipakai bersama (Absensi + POS). Agar POS bisa membuat
-- cabang manual TANPA merusak data sync Ecosystem:
--   1) id auto-generate
--   2) lat/lng opsional (POS tidak menangkap koordinat; submit-attendance saat ini
--      menyimpan gps_lat/lng = NULL, jadi geofence tidak tergantung kolom ini)
--   3) slug di-generate otomatis dari name bila tidak diisi (tetap UNIQUE NOT NULL)
--
-- Jalankan via `supabase db push` ATAU paste ke Supabase SQL Editor (project Absensi).

-- 1. id auto-generate
ALTER TABLE public.outlets ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Koordinat geografis menjadi opsional
ALTER TABLE public.outlets ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE public.outlets ALTER COLUMN lng DROP NOT NULL;

-- 3. Auto-generate slug unik dari name bila kosong (slug tetap UNIQUE NOT NULL)
CREATE OR REPLACE FUNCTION public.outlets_set_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 1;
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    -- slugify: lowercase, ganti non-alfanumerik dengan '-', rapikan tepi
    base_slug := btrim(regexp_replace(lower(btrim(NEW.name)), '[^a-z0-9]+', '-', 'g'), '-');
    IF base_slug = '' THEN
      base_slug := 'outlet';
    END IF;

    final_slug := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.outlets WHERE slug = final_slug AND id <> NEW.id
    ) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;

    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outlets_set_slug ON public.outlets;
CREATE TRIGGER trg_outlets_set_slug
  BEFORE INSERT OR UPDATE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.outlets_set_slug();


-- Merged from 20260612000003_fix_realtime_attendance.sql
-- Fix: Enable Realtime for attendance table + ensure RLS policies
-- Run this in Supabase SQL Editor (Absensi/unified project)

-- 1. Tambahkan tabel attendance ke Realtime publication
-- (Ini yang sebelumnya corrupt dan tidak jalan)
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- 2. Pastikan kasir bisa membaca attendance untuk outlet mereka
-- (diperlukan agar Realtime postgres_changes bisa berfungsi)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance' AND policyname = 'attendance_read_kasir'
  ) THEN
    CREATE POLICY "attendance_read_kasir" ON attendance
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'kasir'
            AND p.outlet_id = attendance.outlet_id
        )
      );
  END IF;
END $$;

-- 3. Pastikan fungsi get_outlet_presence ada
CREATE OR REPLACE FUNCTION get_outlet_presence(p_outlet_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT outlet_staff_id, (array_agg(type ORDER BY ts_server DESC))[1] as latest_type
      FROM attendance
      WHERE outlet_id = p_outlet_id
        AND (ts_server AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
      GROUP BY outlet_staff_id
    ) sub
    WHERE latest_type = 'in'
  );
$$;
