-- Scope baru 'hr_rinci' (gaji & kasbon per orang) untuk kunci Hermes bot HRD.
-- Keputusan owner 2026-10-07. Bot CEO TIDAK boleh diberi scope ini.
ALTER TABLE public.hermes_api_key DROP CONSTRAINT IF EXISTS hermes_api_key_scope_check;
ALTER TABLE public.hermes_api_key ADD CONSTRAINT hermes_api_key_scope_check CHECK (
  cardinality(scope) > 0
  AND scope <@ ARRAY['penjualan','gudang','absensi','finance','hr_rinci']::text[]
);
