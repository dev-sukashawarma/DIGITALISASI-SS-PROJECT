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
