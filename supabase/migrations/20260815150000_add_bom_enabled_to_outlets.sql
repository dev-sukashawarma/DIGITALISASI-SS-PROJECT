-- 20260815150000_add_bom_enabled_to_outlets.sql
-- Tambah kolom is_bom_enabled dengan default TRUE

ALTER TABLE public.outlets 
ADD COLUMN IF NOT EXISTS is_bom_enabled BOOLEAN DEFAULT true;

-- Kita pastikan outlet lama yang tadinya TIDAK ada di allowlist di-set menjadi false
-- AGAR perilaku sebelumnya tetap identik, KECUALI 'outlet tes' yang secara khusus kita nyalakan.
-- Jika global_settings kosong atau formatnya aneh, kita abaikan saja.
DO $$
DECLARE
  v_allowed_outlets TEXT;
  v_allowed_array UUID[];
BEGIN
  SELECT btrim(value::text, '"') INTO v_allowed_outlets 
  FROM public.global_settings
  WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NOT NULL AND v_allowed_outlets != '' THEN
    SELECT array_agg(btrim(x)::uuid) INTO v_allowed_array
    FROM unnest(string_to_array(v_allowed_outlets, ',')) AS x
    WHERE btrim(x) != '';

    -- Set false untuk outlet lama yang tidak ada di daftar allowlist, 
    -- dan kecualikan outlet yang mengandung kata 'tes' (biarkan true karena user ingin mengetes).
    UPDATE public.outlets
    SET is_bom_enabled = false
    WHERE id != ALL(v_allowed_array)
      AND name NOT ILIKE '%tes%';
  END IF;
END $$;
