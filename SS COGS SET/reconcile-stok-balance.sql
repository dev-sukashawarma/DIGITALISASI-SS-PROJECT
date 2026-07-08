-- reconcile-stok-balance.sql
-- DIAGNOSTIK (read-only): deteksi divergensi antara stok_balance.saldo (nilai
-- termaterialisasi) vs SUM(ledger_stok.qty) (sumber kebenaran signed ledger).
--
-- Invariant: untuk tiap (outlet_id, bahan_baku_id),
--   stok_balance.saldo == SUM(ledger_stok.qty)
-- Divergensi = gejala lost-update race (fix 20260708100001) atau reversal
-- over-restore (fix 20260708110000) yang sudah terlanjur mengotori saldo.
--
-- Jalankan SETELAH menerapkan kedua migration fix, untuk menemukan baris yang
-- perlu direkonsiliasi (via opname/adjustment). Query ini TIDAK mengubah data.
-- FULL OUTER JOIN supaya baris yang ada di satu sisi saja (mis. saldo tanpa
-- ledger, atau sebaliknya) ikut tampil.

WITH ledger_sum AS (
  SELECT outlet_id, bahan_baku_id, SUM(qty) AS ledger_saldo
  FROM ledger_stok
  GROUP BY outlet_id, bahan_baku_id
)
SELECT
  o.name                                   AS outlet,
  b.nama                                   AS bahan,
  COALESCE(sb.saldo, 0)                     AS saldo_tercatat,
  COALESCE(ls.ledger_saldo, 0)              AS saldo_ledger,
  COALESCE(sb.saldo, 0) - COALESCE(ls.ledger_saldo, 0) AS selisih,
  sb.updated_at                             AS saldo_updated_at
FROM ledger_sum ls
FULL OUTER JOIN stok_balance sb
  ON sb.outlet_id = ls.outlet_id AND sb.bahan_baku_id = ls.bahan_baku_id
LEFT JOIN outlets o     ON o.id = COALESCE(sb.outlet_id, ls.outlet_id)
LEFT JOIN bahan_baku b  ON b.id = COALESCE(sb.bahan_baku_id, ls.bahan_baku_id)
WHERE COALESCE(sb.saldo, 0) <> COALESCE(ls.ledger_saldo, 0)
ORDER BY ABS(COALESCE(sb.saldo, 0) - COALESCE(ls.ledger_saldo, 0)) DESC;

-- Untuk MEMPERBAIKI baris yang divergen (samakan stok_balance ke ledger sebagai
-- sumber kebenaran) -- REVIEW hasil query di atas dulu sebelum menjalankan:
--
-- UPDATE stok_balance sb
-- SET saldo = ls.ledger_saldo, updated_at = NOW()
-- FROM (
--   SELECT outlet_id, bahan_baku_id, SUM(qty) AS ledger_saldo
--   FROM ledger_stok GROUP BY outlet_id, bahan_baku_id
-- ) ls
-- WHERE sb.outlet_id = ls.outlet_id
--   AND sb.bahan_baku_id = ls.bahan_baku_id
--   AND sb.saldo <> ls.ledger_saldo;
