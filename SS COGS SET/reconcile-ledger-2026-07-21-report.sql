-- reconcile-ledger-2026-07-21-report.sql
-- READ-ONLY. Laporan rekonsiliasi insiden "ranjau timestamp 2030" (ledger_stamp_saldo
-- ter-revert ke versi yang tak menulis stok_balance), tanggal 2026-07-21.
-- Lihat migration 20300103000007_reassert_ledger_stamp_saldo_atomic.sql dan
-- memory stok-balance-ledger-invariant.md untuk kronologi lengkap.
--
-- Metode: bukan window waktu tunggal (ada beberapa episode putus-nyambung per outlet
-- di hari yang sama). Deteksi via pola "saldo_sebelum" yang identik berulang di >=2
-- baris dengan created_at berbeda, untuk (outlet_id, bahan_baku_id) yang sama, dalam
-- tanggal 21 Juli 2026 saja (dibatasi tanggal untuk hindari false-positive dari
-- kebetulan angka bundar/item kembar berulang lintas hari -- divalidasi manual,
-- lihat catatan investigasi sesi 2026-07-22).
-- Baris pertama (created_at paling awal) di tiap grup adalah baris SAH (mewarisi
-- saldo asli); sisanya adalah baris yang efeknya HILANG dari stok_balance -- qty
-- baris-baris itu yang perlu dikoreksi via ledger adjustment baru.
--
-- TIDAK mengubah data apa pun. Jalankan lewat: supabase db query "$(cat ini)" --linked

WITH group_stats AS (
  SELECT outlet_id, bahan_baku_id, saldo_sebelum,
         COUNT(DISTINCT created_at) AS distinct_times
  FROM ledger_stok
  WHERE created_at BETWEEN '2026-07-21 00:00:00+00' AND '2026-07-21 23:59:59+00'
  GROUP BY outlet_id, bahan_baku_id, saldo_sebelum
),
ranked AS (
  SELECT l.outlet_id, l.bahan_baku_id, l.id, l.created_at, l.tipe, l.qty, l.saldo_sebelum,
         ROW_NUMBER() OVER (
           PARTITION BY l.outlet_id, l.bahan_baku_id, l.saldo_sebelum
           ORDER BY l.created_at, l.id
         ) AS rn,
         g.distinct_times
  FROM ledger_stok l
  JOIN group_stats g
    ON g.outlet_id = l.outlet_id
   AND g.bahan_baku_id = l.bahan_baku_id
   AND g.saldo_sebelum = l.saldo_sebelum
  WHERE l.created_at BETWEEN '2026-07-21 00:00:00+00' AND '2026-07-21 23:59:59+00'
)
SELECT
  o.name AS outlet_name,
  b.nama AS bahan_nama,
  b.satuan,
  r.outlet_id,
  r.bahan_baku_id,
  count(*) AS lost_rows,
  sum(r.qty) AS correction_qty,
  min(r.created_at) AS episode_first,
  max(r.created_at) AS episode_last
FROM ranked r
JOIN outlets o ON o.id = r.outlet_id
JOIN bahan_baku b ON b.id = r.bahan_baku_id
WHERE r.distinct_times >= 2 AND r.rn > 1
GROUP BY o.name, b.nama, b.satuan, r.outlet_id, r.bahan_baku_id
ORDER BY o.name, b.nama;
