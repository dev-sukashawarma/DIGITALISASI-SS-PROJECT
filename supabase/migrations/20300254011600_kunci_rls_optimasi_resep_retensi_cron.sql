-- 20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql
--
-- 1. Kunci kembali RLS & privilege public.hermes_bot_registry (serta catat kolom bot_token)
--    dan hapus tabel sisa sesi debug public._temp_sql_output & public._temp_timings.
-- 2. Optimasi public.pemakaian_resep_harian(uuid, date): ganti anti-join penuh atas
--    seluruh riwayat ledger_stok outlet (Bitmap Heap Scan ~124 rb baris / ~8.000 blok)
--    menjadi dua pembacaan berindeks satu putaran (loops=1) via idx_ledger_stok_outlet_created_at
--    dan idx_ledger_stok_ref_order_id (~666 blok, paritas hasil 100%, tetap SECURITY INVOKER).
-- 3. Bersihkan histori selesai cron.job_run_details > 7 hari dan jadwalkan retensi harian
--    cron-job-run-details-retensi-7-hari pada pukul 03:45 WIB (45 20 * * * UTC).
--
-- Spec: docs/superpowers/specs/2026-11-08-db-rls-resep-cron-optimization-design.md

SET lock_timeout = '15s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Keamanan RLS hermes_bot_registry & penghapusan tabel _temp_*
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hermes_bot_registry
  ADD COLUMN IF NOT EXISTS bot_token text;

ALTER TABLE public.hermes_bot_registry ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hermes_bot_registry FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hermes_bot_registry TO service_role;

DROP TABLE IF EXISTS public._temp_sql_output;
DROP TABLE IF EXISTS public._temp_timings;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Optimasi RPC public.pemakaian_resep_harian(uuid, date)
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- Putaran indeks #1 (loops=1): idx_ledger_stok_outlet_created_at pada 1 hari WIB.
  hari_ini AS MATERIALIZED (
    SELECT l.ref_order_id, l.bahan_baku_id, l.qty
    FROM public.ledger_stok l, jendela j
    WHERE l.outlet_id = p_outlet_id
      AND l.tipe = 'pemakaian'
      AND l.created_at >= j.mulai
      AND l.created_at <  j.akhir
  ),
  -- Putaran indeks #2 (loops=1): idx_ledger_stok_ref_order_id untuk seluruh order kandidat
  -- sekaligus lewat = ANY(ARRAY(...)) agar:
  --   (a) tidak memicu Hash Right Anti Join ke seluruh riwayat ledger outlet, dan
  --   (b) policy RLS ledger_read (accessible_outlet_ids()) hanya dievaluasi sekali, bukan per order.
  baris_kandidat AS MATERIALIZED (
    SELECT l.ref_order_id, l.bahan_baku_id, l.qty, l.tipe, l.created_at
    FROM public.ledger_stok l
    WHERE l.ref_order_id = ANY (
      ARRAY(SELECT DISTINCT h.ref_order_id FROM hari_ini h WHERE h.ref_order_id IS NOT NULL)
    )
      AND l.outlet_id = p_outlet_id
      AND l.tipe IN ('pemakaian', 'adjustment')
  ),
  -- Order yang sudah pernah memotong stok sebelum awal hari WIB ini adalah milik hari sebelumnya.
  order_lama AS (
    SELECT DISTINCT p.ref_order_id
    FROM baris_kandidat p, jendela j
    WHERE p.tipe = 'pemakaian'
      AND p.created_at < j.mulai
  ),
  per_order AS (
    SELECT b.bahan_baku_id,
           GREATEST(-SUM(b.qty), 0) AS q
    FROM baris_kandidat b
    LEFT JOIN order_lama ol ON ol.ref_order_id = b.ref_order_id
    WHERE ol.ref_order_id IS NULL
    GROUP BY b.ref_order_id, b.bahan_baku_id
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
  'Pemakaian resep (BOM) bersih per bahan untuk satu outlet & tanggal WIB; order batal dibalik. Dioptimasi di migration 20300254011600.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pembersihan awal & jadwal retensi harian cron.job_run_details (7 hari)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    DELETE FROM cron.job_run_details
    WHERE end_time IS NOT NULL
      AND end_time < now() - interval '7 days';

    PERFORM cron.unschedule('cron-job-run-details-retensi-7-hari')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cron-job-run-details-retensi-7-hari'
    );

    PERFORM cron.schedule(
      'cron-job-run-details-retensi-7-hari',
      '45 20 * * *',
      $cmd$DELETE FROM cron.job_run_details WHERE end_time IS NOT NULL AND end_time < now() - interval '7 days';$cmd$
    );
  END IF;
END $$;
