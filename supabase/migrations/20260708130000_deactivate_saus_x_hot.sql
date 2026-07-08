-- 20260708130000_deactivate_saus_x_hot.sql
-- SAUS X HOT bukan item aktif yang dipakai. Item saus yang valid hanya 3:
-- SAUS CABE/TOMAT, SAUS TOMAT, SAOS SAMYANG.
-- Redirect resep_item yang masih referencing SAUS X HOT ke SAUS CABE/TOMAT,
-- lalu nonaktifkan SAUS X HOT.

-- Step 1: Redirect resep_item → SAUS CABE/TOMAT
-- (SAUS X HOT = 0f30c442-6ef8-4177-8e6f-50797d94d130)
-- (SAUS CABE/TOMAT = 527682ad-96ee-43bb-9f77-eccad84c5976)
UPDATE resep_item
SET bahan_baku_id = '527682ad-96ee-43bb-9f77-eccad84c5976'  -- SAUS CABE/TOMAT
WHERE bahan_baku_id = '0f30c442-6ef8-4177-8e6f-50797d94d130' -- SAUS X HOT
  -- Hindari duplikat jika resep tsb sudah punya SAUS CABE/TOMAT
  AND NOT EXISTS (
    SELECT 1 FROM resep_item ri2
    WHERE ri2.resep_id = resep_item.resep_id
      AND ri2.bahan_baku_id = '527682ad-96ee-43bb-9f77-eccad84c5976'
  );

-- Step 2: Hapus resep_item sisa yang tidak bisa di-redirect (resep sudah punya SAUS CABE/TOMAT)
DELETE FROM resep_item
WHERE bahan_baku_id = '0f30c442-6ef8-4177-8e6f-50797d94d130'; -- SAUS X HOT

-- Step 3: Nonaktifkan SAUS X HOT
UPDATE bahan_baku
SET is_active = false
WHERE id = '0f30c442-6ef8-4177-8e6f-50797d94d130'; -- SAUS X HOT

-- DOWN (rollback):
-- UPDATE bahan_baku SET is_active = true WHERE id = '0f30c442-6ef8-4177-8e6f-50797d94d130';
