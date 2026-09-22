-- Koreksi flag opname_item: AYAM/SAPI (40%) & KENTANG (20%)
-- Aturan toleransi khusus masuk 21 Sep 15:08 (commit 0851a224), tapi opname
-- 21 Sep 20:49-22:40 masih disimpan oleh tab lama (toleransi 5%) -> flagged=true
-- padahal di dalam batas baru. Hanya kolom flagged; stok/ledger tak disentuh.
-- Idempoten: hanya baris yang masih flagged DAN masih di dalam batas.
BEGIN;
UPDATE opname_item oi SET flagged = false
FROM bahan_baku b
WHERE b.id = oi.bahan_baku_id
  AND oi.flagged
  AND oi.qty_system <> 0
  AND abs(oi.selisih) <= (CASE b.nama WHEN 'KENTANG' THEN 0.20 ELSE 0.40 END) * abs(oi.qty_system)
  AND oi.id IN (
    'ceaf10e9-3b19-4ea0-b776-c5e33ea22a6e','75f39124-4bfd-45bf-b581-e5f7516d9d1e',
    'a60f8c5c-e2b2-49cb-8d4d-482b3db481f1','87431628-9df5-4bb5-b4b0-8dd230ad79b5',
    'd2039487-ec64-41e4-9a32-907df2fc8136','cbb88dd1-b0c4-4c48-98bc-b591952d1eea',
    '998f562f-6f85-48a5-a7a5-0f750b8e3795','5f35deab-0e54-4c62-8d35-1e81a54f031b',
    '41acdc86-d7e4-42e0-92b5-6919cb627732','93bed2f4-a5ac-4959-a7a5-a9d97604b8b0',
    '652652ee-1956-461d-9dd6-58a12ec1540c','a3f0df00-948d-4694-885e-c341f8b5b0ce',
    'acca4628-79c2-4573-85ec-b0859e6dfcf1','2517a623-f025-45f5-a325-e232f83e929b');
COMMIT;
