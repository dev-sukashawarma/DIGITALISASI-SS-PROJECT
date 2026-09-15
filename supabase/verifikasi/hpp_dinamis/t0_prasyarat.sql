-- supabase/verifikasi/hpp_dinamis/t0_prasyarat.sql
-- Task 1 (Prasyarat data): pemantau untuk BOM tiga outlet mitra +
-- koreksi tipe Pamulang. Jalankan satu query per giliran, read-only.

-- Q1: status is_bom_enabled & type ketiga outlet + Pamulang (harus selalu
-- true/true/true untuk ketiganya setelah 20260915200000 diterapkan;
-- Pamulang type tetap 'outlet' sampai 20260915201000 di-apply terpisah
-- setelah owner OK).
SELECT name, type, is_bom_enabled
FROM outlets
WHERE name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI','MITRA PAMULANG')
ORDER BY name;

-- Q2: prasyarat stok_balance vs resep aktif per outlet (baseline yang dipakai
-- pre-check migration; ambang diturunkan ke <25 karena bahan_resep_total live
-- hanya 27, bukan >=40 seperti dugaan awal — SAUS CABE & AQUA konsisten tak
-- punya baris stok_balance di ketiga outlet ini, sama seperti 10 outlet lain
-- yang sudah lama menjalankan BOM; itu masalah master data resep, bukan
-- pemblokir go-live).
-- SELECT o.name,
--   (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id
--      AND sb.bahan_baku_id IN (SELECT DISTINCT bahan_baku_id FROM resep_item)) AS sb_bahan_resep,
--   (SELECT count(DISTINCT bahan_baku_id) FROM resep_item ri JOIN bahan_baku b ON b.id=ri.bahan_baku_id WHERE b.is_active) AS bahan_resep_total,
--   (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id AND saldo_is_gram(sb)) AS baris_gram,
--   (SELECT count(*) FROM stok_balance sb WHERE sb.outlet_id=o.id AND NOT saldo_is_gram(sb)) AS baris_besar
-- FROM outlets o WHERE o.name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI');

-- Q3: bukti perilaku — apakah ketiga outlet sudah mulai menulis
-- ledger_stok.tipe='pemakaian' sejak BOM dinyalakan (isi ulang tanggal saat
-- dijalankan; awalnya 0 baris sampai ada order 'completed' pertama).
-- SELECT o.name, count(*) FROM ledger_stok l JOIN outlets o ON o.id=l.outlet_id
-- WHERE l.tipe='pemakaian' AND o.name IN ('MITRA CICURUG','MITRA SENTUL','MITRA CILEUNGSI')
--   AND l.created_at > now() - interval '1 day'
-- GROUP BY 1;
