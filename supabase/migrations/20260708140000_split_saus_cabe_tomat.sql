-- 20260708140000_split_saus_cabe_tomat.sql
-- Split SAUS CABE/TOMAT into SAOS CABE and SAOS TOMAT for 20 recipes.
-- (Changes have already been applied via script, this is for historical syncing if needed)

-- The JS script performed the following actions:
-- 1. Inserted SAOS CABE and SAOS TOMAT into bahan_baku with kategori: 'saus', kategori_core: 'saos'
-- 2. Inserted harga into bahan_baku_harga (Rp 15000 / 1000 gram)
-- 3. Found all resep_item using SAUS CABE/TOMAT (527682ad-96ee-43bb-9f77-eccad84c5976)
-- 4. Replaced them with SAOS CABE (qty_per_porsi / 2) and SAOS TOMAT (qty_per_porsi / 2)
-- 5. Updated SAUS CABE/TOMAT to is_active = false
