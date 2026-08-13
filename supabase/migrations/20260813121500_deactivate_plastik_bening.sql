-- 20260813121500_deactivate_plastik_bening.sql
--
-- PLASTIK BENING dinonaktifkan atas permintaan owner (2026-08-13). Tidak
-- dipakai di resep_item manapun (0 baris BOM aktif referensi item ini), jadi
-- aman dinonaktifkan tanpa dampak ke pemotongan stok otomatis. Dinonaktifkan
-- (bukan DELETE) agar riwayat ledger_stok/opname_item/stok_balance tetap
-- utuh untuk audit, konsisten dengan pola di
-- 20260813120000_rename_minyak_sayur_to_minyak.sql.

UPDATE bahan_baku
SET is_active = false
WHERE id = 'bf5e533b-c264-4998-a234-fa7ded806c85' AND nama = 'PLASTIK BENING';
