-- 20260629120000_add_kantor_pusat_outlet.sql
-- Menambahkan outlet "Kantor Pusat" sebagai penanda untuk role staff_pusat.
-- Diset type = 'office' dan is_active = false agar tidak ikut serta 
-- dalam operasional reguler (seperti POS, distribusi, dsb) yang biasanya 
-- memfilter berdasarkan type = 'outlet' atau is_active = true.

INSERT INTO public.outlets (
  id,
  slug,
  name,
  type,
  is_active,
  lat,
  lng,
  address
) VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff', -- UUID statis khusus
  'kantor-pusat',
  'Kantor Pusat',
  'office',
  false,
  -6.200000,
  106.816666,
  'Kantor Pusat Manajemen'
) ON CONFLICT (slug) DO NOTHING;
