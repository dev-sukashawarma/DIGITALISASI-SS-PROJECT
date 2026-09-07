-- 20260907000000_waste_dashboard_rpcs.sql
--
-- Dua RPC untuk halaman /dashboard/owner/waste (admin-dashboard) yang dirombak.
-- Spec: docs/superpowers/specs/2026-09-07-waste-dashboard-comprehensive-design.md
--
-- KENAPA DUA, BUKAN SATU: PostgREST memotong hasil RPC di 1.000 baris tanpa
-- error. Satu bulan waste di 19 outlet berpotensi melewatinya, dan total yang
-- terpotong lebih berbahaya daripada tidak ada total karena angkanya tetap
-- terlihat masuk akal. Jadi agregat di-roll up di server (hasil kecil), daftar
-- insiden dipaginasi di server (hasil dibatasi 100).
--
-- PERBAIKAN VALUASI: hpp_kecil kini dibagi kemasan_qty (basis harga kanonik
-- 2026-09-03), bukan faktor_konversi seperti get_waste_breakdown. Ini HANYA
-- mengubah kolom tampilan per-satuan. Kolom `nilai` (= qty * harga_beli) tidak
-- disentuh dan tidak menggeser satu rupiah pun di total mana pun.
--
-- TIDAK MENYENTUH get_waste_periode (menyuplai Profit/Expenses -> Laba Bersih)
-- maupun get_waste_breakdown (masih dipakai konsumen lain).

-- ── 1. Agregat ────────────────────────────────────────────────────────────
-- Satu baris per (outlet, bahan, alasan, tanggal). Menyuplai seluruh tile,
-- chart, dan ranking di halaman.

CREATE OR REPLACE FUNCTION get_waste_summary_v2(p_from date, p_to date)
RETURNS TABLE(
  outlet_id uuid,
  outlet_name text,
  bahan_baku_id uuid,
  bahan_nama text,
  reason text,
  tanggal date,
  qty numeric,
  qty_kecil numeric,
  satuan_kecil text,
  hpp_kecil numeric,
  nilai numeric,
  jumlah_insiden bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      w.outlet_id                                   AS s_outlet_id,
      o.name                                        AS s_outlet_name,
      w.bahan_baku_id                               AS s_bahan_baku_id,
      b.nama                                        AS s_bahan_nama,
      w.reason                                      AS s_reason,
      (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS s_tanggal,
      w.qty                                         AS s_qty,
      b.satuan_kecil                                AS s_satuan_kecil,
      COALESCE(bh.harga_beli, 0)                    AS s_harga_beli,
      NULLIF(bh.kemasan_qty, 0)                     AS s_kemasan_qty,
      -- faktor penuh (kecil per besar) -- ekspresi kanonik, sama persis dengan
      -- 20300120000001, trg_process_bom_stok, dan to_ledger_scale().
      GREATEST(
        COALESCE(
          CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
               THEN b.faktor_tampilan
               ELSE b.faktor_konversi
          END,
          1
        ),
        1
      ) AS s_faktor_penuh
    FROM stok_waste_reports w
    JOIN outlets o     ON o.id = w.outlet_id
    JOIN bahan_baku b  ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND w.outlet_id IN (SELECT public.accessible_outlet_ids())
  )
  SELECT
    s.s_outlet_id,
    s.s_outlet_name,
    s.s_bahan_baku_id,
    s.s_bahan_nama,
    s.s_reason,
    s.s_tanggal,
    SUM(s.s_qty)::numeric,
    SUM(s.s_qty * s.s_faktor_penuh)::numeric,
    s.s_satuan_kecil,
    (s.s_harga_beli / COALESCE(s.s_kemasan_qty, s.s_faktor_penuh))::numeric,
    SUM(s.s_qty * s.s_harga_beli)::numeric,
    COUNT(*)::bigint
  FROM scoped s
  GROUP BY
    s.s_outlet_id, s.s_outlet_name, s.s_bahan_baku_id, s.s_bahan_nama,
    s.s_reason, s.s_tanggal, s.s_satuan_kecil, s.s_harga_beli,
    s.s_kemasan_qty, s.s_faktor_penuh;
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_summary_v2(date, date) TO authenticated;

-- ── 2. Daftar insiden (terpaginasi) ───────────────────────────────────────
-- Satu baris per laporan waste. p_outlet_id NULL = semua outlet yang boleh
-- diakses. total_count dihitung window function SEBELUM LIMIT, jadi UI bisa
-- menampilkan jumlah halaman yang jujur.
--
-- ledger_row_count menjawab kelas bug yang didokumentasikan 20300120000002:
-- laporan APPROVED yang tidak pernah menghasilkan baris ledger sama sekali
-- (4 kasus nyata Agustus 2026). Yang dilaporkan KEBERADAAN, bukan kecocokan
-- qty -- skala ledger bergantung saldo_is_gram sedangkan qty laporan selalu
-- satuan besar, jadi perbandingan langsung akan memicu alarm palsu.

CREATE OR REPLACE FUNCTION get_waste_incidents(
  p_from      date,
  p_to        date,
  p_outlet_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 25,
  p_offset    int  DEFAULT 0
)
RETURNS TABLE(
  id               uuid,
  outlet_id        uuid,
  outlet_name      text,
  bahan_baku_id    uuid,
  bahan_nama       text,
  reason           text,
  qty              numeric,
  qty_kecil        numeric,
  satuan_besar     text,
  satuan_kecil     text,
  hpp_kecil        numeric,
  nilai            numeric,
  photo_url        text,
  reporter_name    text,
  approver_name    text,
  created_at       timestamptz,
  updated_at       timestamptz,
  ledger_row_count bigint,
  total_count      bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      w.id                       AS s_id,
      w.outlet_id                AS s_outlet_id,
      o.name                     AS s_outlet_name,
      w.bahan_baku_id            AS s_bahan_baku_id,
      b.nama                     AS s_bahan_nama,
      w.reason                   AS s_reason,
      w.qty                      AS s_qty,
      b.satuan                   AS s_satuan_besar,
      b.satuan_kecil             AS s_satuan_kecil,
      w.photo_url                AS s_photo_url,
      rep.name                   AS s_reporter_name,
      apr.name                   AS s_approver_name,
      w.created_at               AS s_created_at,
      w.updated_at               AS s_updated_at,
      COALESCE(bh.harga_beli, 0) AS s_harga_beli,
      NULLIF(bh.kemasan_qty, 0)  AS s_kemasan_qty,
      GREATEST(
        COALESCE(
          CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
               THEN b.faktor_tampilan
               ELSE b.faktor_konversi
          END,
          1
        ),
        1
      ) AS s_faktor_penuh
    FROM stok_waste_reports w
    JOIN outlets o    ON o.id = w.outlet_id
    JOIN bahan_baku b ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    LEFT JOIN outlet_staff rep    ON rep.id = w.reported_by
    LEFT JOIN outlet_staff apr    ON apr.id = w.approved_by
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND w.outlet_id IN (SELECT public.accessible_outlet_ids())
      AND (p_outlet_id IS NULL OR w.outlet_id = p_outlet_id)
  )
  SELECT
    s.s_id,
    s.s_outlet_id,
    s.s_outlet_name,
    s.s_bahan_baku_id,
    s.s_bahan_nama,
    s.s_reason,
    s.s_qty,
    (s.s_qty * s.s_faktor_penuh)::numeric,
    s.s_satuan_besar,
    s.s_satuan_kecil,
    (s.s_harga_beli / COALESCE(s.s_kemasan_qty, s.s_faktor_penuh))::numeric,
    (s.s_qty * s.s_harga_beli)::numeric,
    s.s_photo_url,
    s.s_reporter_name,
    s.s_approver_name,
    s.s_created_at,
    s.s_updated_at,
    (SELECT COUNT(*) FROM ledger_stok l WHERE l.ref_waste_id = s.s_id)::bigint,
    -- Tanda kurung luar WAJIB: `COUNT(*) OVER ()::bigint` salah parse.
    (COUNT(*) OVER ())::bigint
  FROM scoped s
  ORDER BY s.s_created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_incidents(date, date, uuid, int, int) TO authenticated;
