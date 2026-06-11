-- =====================================================================
-- SEED DATA — E2E Test M2 + M3 (lihat docs/E2E-TEST-M2-M3.md)
-- =====================================================================
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase SQL Editor.
--
-- Strategi: baseline saldo di-set lewat ledger `adjustment` (delta =
-- target - saldo_sekarang), BUKAN INSERT langsung ke stok_balance.
-- Alasan: trigger ledger yang memelihara stok_balance, sehingga
-- saldo SELALU konsisten dengan SUM(ledger) → lolos cek integritas (TEST C2).
--
-- Outlet ref (dari 20260609000500_seed_outlets.sql):
--   KITCHEN  = 550e8400-e29b-41d4-a716-446655440001
--   EMPANG   = 550e8400-e29b-41d4-a716-446655440002
--   PALEDANG = 550e8400-e29b-41d4-a716-446655440003
--   SUKMAJAYA= 550e8400-e29b-41d4-a716-446655440005
-- =====================================================================

-- 1) Pastikan bahan_baku master ada (idempotent; tidak menimpa data lama)
INSERT INTO bahan_baku (nama, satuan, kategori, default_reorder_point) VALUES
  ('AYAM',    'kg',   'protein', 30),
  ('BAWANG',  'kg',   'sayur',    5),
  ('KENTANG', 'pack', 'sayur',   10)
ON CONFLICT (nama) DO NOTHING;

-- 2) Set baseline saldo via ledger adjustment (idempotent: re-run = delta 0 = skip)
DO $$
DECLARE
  v_row   record;
  v_bahan uuid;
  v_cur   numeric;
  v_delta numeric;
  -- daftar (outlet, bahan, target_saldo) yang ingin di-set
  v_targets jsonb := '[
    {"outlet":"550e8400-e29b-41d4-a716-446655440002","bahan":"AYAM",   "target":10},
    {"outlet":"550e8400-e29b-41d4-a716-446655440002","bahan":"BAWANG", "target":4},
    {"outlet":"550e8400-e29b-41d4-a716-446655440002","bahan":"KENTANG","target":8},

    {"outlet":"550e8400-e29b-41d4-a716-446655440001","bahan":"AYAM",   "target":200},
    {"outlet":"550e8400-e29b-41d4-a716-446655440001","bahan":"BAWANG", "target":50},
    {"outlet":"550e8400-e29b-41d4-a716-446655440001","bahan":"KENTANG","target":50},

    {"outlet":"550e8400-e29b-41d4-a716-446655440003","bahan":"AYAM",   "target":40},
    {"outlet":"550e8400-e29b-41d4-a716-446655440003","bahan":"BAWANG", "target":8},
    {"outlet":"550e8400-e29b-41d4-a716-446655440003","bahan":"KENTANG","target":15},

    {"outlet":"550e8400-e29b-41d4-a716-446655440005","bahan":"AYAM",   "target":40},
    {"outlet":"550e8400-e29b-41d4-a716-446655440005","bahan":"BAWANG", "target":8},
    {"outlet":"550e8400-e29b-41d4-a716-446655440005","bahan":"KENTANG","target":15}
  ]'::jsonb;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_to_recordset(v_targets)
                 AS t(outlet uuid, bahan text, target numeric)
  LOOP
    SELECT id INTO v_bahan FROM bahan_baku WHERE nama = v_row.bahan;
    IF v_bahan IS NULL THEN
      RAISE NOTICE 'Bahan % tidak ditemukan, lewati', v_row.bahan;
      CONTINUE;
    END IF;

    SELECT COALESCE(saldo, 0) INTO v_cur
    FROM stok_balance
    WHERE outlet_id = v_row.outlet AND bahan_baku_id = v_bahan;
    v_cur := COALESCE(v_cur, 0);

    v_delta := v_row.target - v_cur;

    IF v_delta <> 0 THEN
      INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
      VALUES (v_row.outlet, v_bahan, 'adjustment', v_delta,
              'E2E seed baseline → target ' || v_row.target);
      RAISE NOTICE 'Outlet % bahan %: % → % (delta %)',
        v_row.outlet, v_row.bahan, v_cur, v_row.target, v_delta;
    END IF;
  END LOOP;
END $$;

-- 3) Verifikasi hasil seed
SELECT o.name AS outlet, b.nama AS bahan, sb.saldo, b.default_reorder_point
FROM stok_balance sb
JOIN outlets o     ON o.id = sb.outlet_id
JOIN bahan_baku b  ON b.id = sb.bahan_baku_id
WHERE o.id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440005')
  AND b.nama IN ('AYAM','BAWANG','KENTANG')
ORDER BY o.name, b.nama;

-- Cek konsistensi saldo vs ledger (harus 0 baris)
SELECT outlet_id, bahan_baku_id
FROM (
  SELECT outlet_id, bahan_baku_id, SUM(qty) AS computed
  FROM ledger_stok GROUP BY outlet_id, bahan_baku_id
) agg
JOIN stok_balance sb USING (outlet_id, bahan_baku_id)
WHERE ABS(agg.computed - sb.saldo) > 0.001;
