-- Pulihkan AYAM di "outlet tes" setelah uji bug finalize_opname (3 Sep 2026)
--
-- Uji sengaja merusak baris ini untuk membuktikan bug skala:
--   saldo tersimpan 10 (satuan besar) + selisih -1.000 (gram) = -990
--   Yang benar: 9.000 gram, sesuai hitungan fisik 9 Kg yang dimasukkan.
--
-- Dipulihkan lewat ledger adjustment, BUKAN UPDATE stok_balance langsung --
-- mengikuti SOP proyek: trigger yang mengurus saldo.
--
--   delta = 9.000 - (-990) = 9.990
--
-- Baris ini sekarang sudah gram-scale (opname uji membalikkannya), jadi 9.000
-- akan terbaca sebagai 9.000 gram = 9 Kg. Benar.

-- Sebelum
SELECT b.nama, public.saldo_is_gram(sb) AS gram, sb.saldo::text AS saldo_sebelum
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.outlet_id = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
  AND b.nama = 'AYAM';

-- Pemulihan
INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_at)
SELECT 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid,
       b.id,
       'adjustment'::text,
       9990,
       'Pulihkan AYAM outlet tes setelah uji bug skala finalize_opname. '
       || 'Saldo -990 adalah hasil penjumlahan dua satuan berbeda '
       || '(10 satuan besar + (-1.000) gram). Dikembalikan ke 9.000 gram '
       || 'sesuai hitungan fisik 9 Kg.',
       NOW()
FROM bahan_baku b
WHERE b.nama = 'AYAM';

-- Sesudah — harus 9000
SELECT b.nama, public.saldo_is_gram(sb) AS gram, sb.saldo::text AS saldo_sesudah
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.outlet_id = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
  AND b.nama = 'AYAM';
