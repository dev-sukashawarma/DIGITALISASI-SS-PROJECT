-- Pemakaian resep (BOM) satu outlet pada satu tanggal WIB, bersih setelah
-- pembalik order batal. Dipakai layar Detail Opname (web `OpnameDetail.tsx`
-- & native `DetailOpnameScreen.kt`).
--
-- Kenapa RPC, bukan select ledger_stok dari klien:
--   1. Outlet ramai menulis 1.000–3.100 baris `pemakaian` per hari, sedangkan
--      PostgREST memotong hasil di 1.000 baris tanpa urutan. Klien lama hanya
--      menjumlah sebagian (Cileungsi 19 Okt: 1.000 dari 2.028 baris).
--   2. Order yang dibatalkan dibalik trigger BOM sebagai baris `adjustment`
--      positif ber-`ref_order_id` — klien lama tidak melihatnya, jadi order
--      batal tetap terhitung terpakai.
--
-- Aturan atribusi (per order × bahan):
--   - Nilai bersih = −SUM(qty) seluruh baris `pemakaian` + `adjustment` order
--     itu, di tanggal mana pun pembaliknya terjadi (±56% pembalik terjadi
--     di hari setelah pemakaiannya). Tidak pernah negatif.
--   - Nilai itu dihitung SEKALI, di tanggal baris `pemakaian` PERTAMA order
--     tersebut. Order yang selesai→batal→selesai lagi di hari berbeda tidak
--     dihitung dua kali dan pembaliknya tidak mengurangi dua hari.
--   - Baris `pemakaian` tanpa `ref_order_id` dihitung apa adanya di tanggalnya.
--
-- Satuan: qty mentah ledger (skala `stok_balance.saldo_is_gram` per baris),
-- sama dengan yang dibaca klien sebelumnya.
--
-- SECURITY INVOKER: tunduk pada RLS `ledger_read` pemanggil, jadi crew hanya
-- mendapat outletnya sendiri dan outlet di luar cakupan menghasilkan 0 baris.

CREATE OR REPLACE FUNCTION public.pemakaian_resep_harian(p_outlet_id uuid, p_tanggal date)
RETURNS TABLE (bahan_baku_id uuid, qty numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH jendela AS (
    SELECT (p_tanggal::timestamp AT TIME ZONE 'Asia/Jakarta')       AS mulai,
           ((p_tanggal + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') AS akhir
  ),
  hari_ini AS (
    SELECT l.ref_order_id, l.bahan_baku_id, l.qty
    FROM ledger_stok l, jendela j
    WHERE l.outlet_id = p_outlet_id
      AND l.tipe = 'pemakaian'
      AND l.created_at >= j.mulai
      AND l.created_at <  j.akhir
  ),
  kandidat AS MATERIALIZED (
    SELECT DISTINCT h.ref_order_id FROM hari_ini h WHERE h.ref_order_id IS NOT NULL
  ),
  order_milik_hari_ini AS MATERIALIZED (
    SELECT k.ref_order_id
    FROM kandidat k, jendela j
    WHERE NOT EXISTS (
      SELECT 1 FROM ledger_stok e
      WHERE e.ref_order_id = k.ref_order_id
        AND e.outlet_id = p_outlet_id
        AND e.tipe = 'pemakaian'
        AND e.created_at < j.mulai
    )
  ),
  -- OFFSET 0 menahan planner meratakan LATERAL ini jadi hash join atas
  -- SELURUH riwayat ledger outlet (±80 rb baris, 1,8 dtk di Cileungsi);
  -- per order lewat idx_ledger_stok_ref_order_id cuma ±7 ms.
  per_order AS (
    SELECT x.bahan_baku_id, GREATEST(-SUM(x.qty), 0) AS q
    FROM order_milik_hari_ini o
    CROSS JOIN LATERAL (
      SELECT l.bahan_baku_id, l.qty
      FROM ledger_stok l
      WHERE l.ref_order_id = o.ref_order_id
        AND l.outlet_id = p_outlet_id
        AND l.tipe IN ('pemakaian', 'adjustment')
      OFFSET 0
    ) x
    GROUP BY o.ref_order_id, x.bahan_baku_id
  ),
  tanpa_order AS (
    SELECT h.bahan_baku_id, -h.qty AS q
    FROM hari_ini h
    WHERE h.ref_order_id IS NULL
  )
  SELECT x.bahan_baku_id, SUM(x.q)::numeric AS qty
  FROM (SELECT * FROM per_order UNION ALL SELECT * FROM tanpa_order) x
  GROUP BY x.bahan_baku_id
  HAVING SUM(x.q) > 0;
$$;

REVOKE ALL ON FUNCTION public.pemakaian_resep_harian(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pemakaian_resep_harian(uuid, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.pemakaian_resep_harian(uuid, date) IS
  'Pemakaian resep (BOM) bersih per bahan untuk satu outlet & tanggal WIB; order batal dibalik. Lihat migration 20261020100000.';
