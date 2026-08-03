-- 20300104000003_fix_minyak_sayur_faktor.sql
-- Keputusan owner 2026-08-02: 1 kompan MINYAK SAYUR = 16 liter.
-- Membatalkan angka "16 liter" yang tercatat di SS COGS SET/unit-reconciliation.md
-- (4 Juli) tapi tidak pernah ditulis ke DB, dan angka 18 yang ada sekarang.
--
-- Ketiga faktor salah:
--   faktor_tengah    18      -> 16      (liter per kompan)
--   faktor_tampilan  324000  -> 16000   (ml per kompan)
--   faktor_konversi  18000   -> 1000    (ml per liter)
--
-- 324.000 berasal dari 18 x 18.000, yaitu menganggap 1 "Liter" = 18 liter.
-- Nama tingkat tengah 'Liter' menyesatkan (isinya jeriken) -- penggantian nama
-- adalah keputusan data terpisah, tidak dilakukan di sini.
--
-- DAMPAK: trigger BOM memotong qty/faktor_konversi, jadi potongan minyak menjadi
-- 18x lebih besar (sebelumnya nyaris tak tercatat di 19 resep). Saldo bisa minus;
-- itu tidak menggagalkan penjualan karena tipe 'pemakaian' dikecualikan dari guard
-- no-negative di ledger_stamp_saldo. Saldo benar ditetapkan ulang oleh opname.

UPDATE public.bahan_baku
SET faktor_tengah   = 16,
    faktor_tampilan = 16000,
    faktor_konversi = 1000
WHERE nama = 'MINYAK SAYUR';
