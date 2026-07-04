-- 20260704140000_cogs_deactivate_stale_resep.sql
-- Ditemukan 2 resep aktif (scope=global) ter-link ke menu yang sama "Original Mix Jumbo":
--   - "Resep Original Mix Jumbo" (id 3410ab1b-..., dibuat 2026-07-01, cuma 3 bahan) -- data lama/tidak lengkap
--   - "Shawarma Mix Jumbo" (id 60d1dc68-..., dibuat 2026-07-04, 13 bahan) -- dari cogs-bom-normalized.json, tervalidasi
-- Trigger BOM (trg_process_bom_stok) memilih resep via LIMIT 1 tanpa tie-breaker eksplisit
-- kalau ada >1 resep global aktif utk menu yang sama -> ambigu, bisa salah pilih resep 3-bahan.
-- Owner (2026-07-04) memutuskan: nonaktifkan resep lama, bukan hapus (tetap ada utk audit).

UPDATE resep
SET is_active = false
WHERE id = '3410ab1b-dcbf-4431-8276-7e0e8eca9331'
  AND nama = 'Resep Original Mix Jumbo';
