-- Scope baru 'review' (Google Reviews SukaReview) untuk kunci Hermes.
-- Diterapkan agar bot review / bot owner dapat mengakses domain ulasan pelanggan.
ALTER TABLE public.hermes_api_key DROP CONSTRAINT IF EXISTS hermes_api_key_scope_check;
ALTER TABLE public.hermes_api_key ADD CONSTRAINT hermes_api_key_scope_check CHECK (
  cardinality(scope) > 0
  AND scope <@ ARRAY['penjualan','stok','absensi','finance','mitra','app_retail','sistem','hr_rinci','review']::text[]
);
