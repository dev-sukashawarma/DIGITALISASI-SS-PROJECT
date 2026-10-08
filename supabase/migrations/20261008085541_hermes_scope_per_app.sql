-- Scope kunci Hermes = daftar app (spec 2026-10-08-bot-ceo-semua-app §4.1).
-- Versi berkas = stempel apply_migration (20261008085541), diterapkan 2026-10-08.
-- 'gudang' diganti 'stok' (0 kunci memakai 'gudang', dicek 2026-10-08);
-- tambah 'mitra', 'app_retail', 'sistem'. 'hr_rinci' (Bot HRD) dipertahankan.
-- Bot CEO TIDAK boleh diberi 'hr_rinci'.
ALTER TABLE public.hermes_api_key DROP CONSTRAINT IF EXISTS hermes_api_key_scope_check;
ALTER TABLE public.hermes_api_key ADD CONSTRAINT hermes_api_key_scope_check CHECK (
  cardinality(scope) > 0
  AND scope <@ ARRAY['penjualan','stok','absensi','finance','mitra','app_retail','sistem','hr_rinci']::text[]
);
