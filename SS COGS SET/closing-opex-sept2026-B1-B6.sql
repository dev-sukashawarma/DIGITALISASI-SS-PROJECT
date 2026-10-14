-- ARSIP — perubahan data closing OPEX internal September 2026 (spec §5).
-- Jalankan blok TERAPKAN sekali. Blok BATALKAN mengembalikan nilai lama
-- (nilai lama diambil dari DB live 14 Okt 2026 sebelum diterapkan).
--
-- B1 (PDAM pusat 972.800) DIBATALKAN: sudah diinput finance 14 Okt 16:33
-- (id 967ef637-9b2a-4d39-954c-86434872e0fa, "PDAM KANTOR"). Menjalankan B1 akan dobel.

-- ===== TERAPKAN =====
BEGIN;
-- B2 bahan baku pusat (6 baris, Rp 6.569.623) -> pengeluaran global
UPDATE expenses SET category = 'pengeluaran_global'
WHERE category = 'bahan_baku' AND outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND id IN (
  '62c9b004-3a56-4002-9b27-779fbedabf4f','e36aeb3b-3453-4352-bb9c-e184ffa4fdf9','219b4ba1-1549-4cc8-8bff-4c313f025cd0',
  'e9e865fd-d540-41b5-83b7-ee8bc4ac65ce','b4dba466-2427-49df-91c6-85e97a3ff6d8','0ea83a1b-46a0-4d3f-9d7e-e958c3684b62');
-- B3a internet Jatiasih (260.850), B3b lembur Aby (50.000) -> Kantor Pusat pengeluaran global
UPDATE expenses SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff', category = 'pengeluaran_global'
WHERE id IN ('04596554-8e55-4f7b-9a13-e1bc045a7162','01d62570-a308-4044-9ab4-7a331c9401b7')
  AND outlet_id IN ('550e8400-e29b-41d4-a716-446655440012','550e8400-e29b-41d4-a716-446655440001');
-- B4 biaya GUDANG SS ONLINE (3 baris, Rp 1.504.609) -> Kantor Pusat bahan baku
UPDATE expenses SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff', category = 'bahan_baku'
WHERE outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91' AND id IN (
  '4af51337-f11a-482d-a4c7-f14f7713fcab','5355e335-c712-4fd2-8595-9e264826f9e6','15a180c9-78e3-4e8b-b872-5e7510b188d1');
-- B5 Indihome SS Dapur (260.850) -> GUDANG SS ONLINE
UPDATE expenses SET outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
WHERE id = '3c18a536-afb1-4dd9-8d6f-9f04ea3ca35d' AND outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
-- B6 token listrik kantor 5.002.750 -> 4.502.475
UPDATE expenses SET amount = 4502475
WHERE id = '1d6d2e62-d808-4834-94cb-6c3072c9842b' AND amount = 5002750;
COMMIT;

-- ===== BATALKAN =====
-- BEGIN;
-- UPDATE expenses SET category = 'bahan_baku' WHERE id IN ('62c9b004-3a56-4002-9b27-779fbedabf4f','e36aeb3b-3453-4352-bb9c-e184ffa4fdf9','219b4ba1-1549-4cc8-8bff-4c313f025cd0','e9e865fd-d540-41b5-83b7-ee8bc4ac65ce','b4dba466-2427-49df-91c6-85e97a3ff6d8','0ea83a1b-46a0-4d3f-9d7e-e958c3684b62');
-- UPDATE expenses SET outlet_id = '550e8400-e29b-41d4-a716-446655440012', category = 'internet' WHERE id = '04596554-8e55-4f7b-9a13-e1bc045a7162';
-- UPDATE expenses SET outlet_id = '550e8400-e29b-41d4-a716-446655440001', category = 'lembur' WHERE id = '01d62570-a308-4044-9ab4-7a331c9401b7';
-- UPDATE expenses SET outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91', category = 'bahan_baku' WHERE id IN ('4af51337-f11a-482d-a4c7-f14f7713fcab','5355e335-c712-4fd2-8595-9e264826f9e6');
-- UPDATE expenses SET outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91', category = 'pengeluaran_outlet' WHERE id = '15a180c9-78e3-4e8b-b872-5e7510b188d1';
-- UPDATE expenses SET outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' WHERE id = '3c18a536-afb1-4dd9-8d6f-9f04ea3ca35d';
-- UPDATE expenses SET amount = 5002750 WHERE id = '1d6d2e62-d808-4834-94cb-6c3072c9842b';
-- COMMIT;
