-- ARSIP — SUDAH DIJALANKAN 2026-11-06. JANGAN DIJALANKAN ULANG.
--
-- Keputusan owner (2026-11-06): sewa outlet mitra hanya untuk MITRA CIBINONG,
-- MITRA PEKAYON, dan MITRA PALEDANG. Outlet mitra lain belum setahun, jadi
-- biaya sewa outletnya dikeluarkan.
--
-- Cakupan: hanya Oktober 2026. Closing September (Excel owner,
-- MITRA_CLOSING_DATA_SEPTEMBER_2026) SENGAJA tidak disentuh.
--
-- Efek: laba Oktober Cicurug +2.500.000, Sentul +1.250.000; sewa Oktober tidak
-- lagi terbawa (rollover) ke prorata November.
--
-- Catatan: kedua baris berasal dari "formulir validasi Finance" (14 Okt 2026).
-- Mengisi ulang formulir itu bisa memunculkan sewa lagi.
--
-- Baris yang dihapus:
--   b5b10dec-f0ce-4d90-a23b-ae9e1378692d  MITRA CICURUG  (outlet d9a2ef93-c298-4501-a471-1c5e2b3dff08)
--     2026-10-01  2.500.000  "Biaya Sewa Outlet MITRA CICURUG Oktober 2026 (formulir validasi Finance)"
--   4640e193-0c1b-461b-b5d3-724cedea7f86  MITRA SENTUL   (outlet 43b7bbd1-1fd4-44b5-87ca-b07a271151af)
--     2026-10-01  1.250.000  "Biaya Sewa Outlet MITRA SENTUL Oktober 2026 (formulir validasi Finance)"
--
-- Sesudah: catatan sewa mitra tersisa = Cibinong Okt 1.834.000, Pekayon Okt
-- 1.750.000, Paledang Agu 1.666.667.

DELETE FROM expenses
WHERE id IN ('b5b10dec-f0ce-4d90-a23b-ae9e1378692d','4640e193-0c1b-461b-b5d3-724cedea7f86')
  AND category = 'sewa_outlet' AND period_month = '2026-10-01'
RETURNING id, outlet_id, amount, description;
