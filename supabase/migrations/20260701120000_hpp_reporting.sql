-- 20260701120000_hpp_reporting.sql
-- HPP bahan baku: snapshot harga per surat jalan + view/fungsi HPP periodik.
-- Aditif. Basis ADR-011 (opname harian + harga terakhir + snapshot per Order Session).

-- 1. Kolom snapshot harga di item surat jalan.
ALTER TABLE surat_jalan_item
  ADD COLUMN IF NOT EXISTS harga_snapshot NUMERIC NOT NULL DEFAULT 0 CHECK (harga_snapshot >= 0);

-- 2. Trigger SECURITY DEFINER: isi snapshot dari harga master saat item dibuat.
--    Pembuat surat jalan (kitchen/pusat) tak boleh baca bahan_baku_harga (admin-only),
--    jadi fungsi harus DEFINER agar bisa membaca harga.
CREATE OR REPLACE FUNCTION fill_harga_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN
    SELECT COALESCE(harga_beli, 0) INTO NEW.harga_snapshot
    FROM bahan_baku_harga WHERE bahan_baku_id = NEW.bahan_baku_id;
    NEW.harga_snapshot := COALESCE(NEW.harga_snapshot, 0);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fill_harga_snapshot ON surat_jalan_item;
CREATE TRIGGER trg_fill_harga_snapshot
  BEFORE INSERT ON surat_jalan_item
  FOR EACH ROW EXECUTE FUNCTION fill_harga_snapshot();

-- 3. View: nilai stok harian per outlet (opname finalized × harga snapshot terbaru <= tanggal).
CREATE OR REPLACE VIEW hpp_nilai_stok_harian_spv WITH (security_barrier = true) AS
SELECT op.outlet_id, op.tanggal, SUM(oi.qty_fisik * lp.harga) AS nilai_stok
FROM opname op
JOIN opname_item oi ON oi.opname_id = op.id
JOIN LATERAL (
  SELECT sji.harga_snapshot AS harga
  FROM surat_jalan_item sji JOIN surat_jalan sj ON sj.id = sji.surat_jalan_id
  WHERE sj.outlet_id = op.outlet_id AND sji.bahan_baku_id = oi.bahan_baku_id
    AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date <= op.tanggal
    AND sji.harga_snapshot > 0
  ORDER BY sj.created_at DESC LIMIT 1
) lp ON true
WHERE op.status = 'finalized' AND op.tipe = 'harian' AND oi.qty_fisik IS NOT NULL
GROUP BY op.outlet_id, op.tanggal;

GRANT SELECT ON hpp_nilai_stok_harian_spv TO authenticated;

-- 4. View: barang masuk harian per outlet (qty terverifikasi × snapshot, tanggal = surat jalan dibuat).
CREATE OR REPLACE VIEW hpp_barang_masuk_harian_spv WITH (security_barrier = true) AS
SELECT sj.outlet_id,
       (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
       SUM(sji.qty_terima * sji.harga_snapshot) AS nilai_masuk
FROM surat_jalan sj JOIN surat_jalan_item sji ON sji.surat_jalan_id = sj.id
WHERE sji.qty_terima IS NOT NULL
GROUP BY sj.outlet_id, (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date;

GRANT SELECT ON hpp_barang_masuk_harian_spv TO authenticated;

-- 5. Fungsi HPP periode (per-batas, scoped ke outlet yang boleh diakses pemanggil).
CREATE OR REPLACE FUNCTION get_hpp_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, hpp numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH stok_awal AS (
    SELECT DISTINCT ON (outlet_id) outlet_id, nilai_stok
    FROM hpp_nilai_stok_harian_spv WHERE tanggal < p_from
    ORDER BY outlet_id, tanggal DESC
  ),
  stok_akhir AS (
    SELECT DISTINCT ON (outlet_id) outlet_id, nilai_stok
    FROM hpp_nilai_stok_harian_spv WHERE tanggal <= p_to
    ORDER BY outlet_id, tanggal DESC
  ),
  masuk AS (
    SELECT outlet_id, SUM(nilai_masuk) AS total
    FROM hpp_barang_masuk_harian_spv WHERE tanggal BETWEEN p_from AND p_to
    GROUP BY outlet_id
  )
  SELECT o.id,
    COALESCE(sa.nilai_stok,0) + COALESCE(m.total,0) - COALESCE(se.nilai_stok,0)
  FROM outlets o
  LEFT JOIN stok_awal sa ON sa.outlet_id = o.id
  LEFT JOIN stok_akhir se ON se.outlet_id = o.id
  LEFT JOIN masuk m ON m.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION get_hpp_periode(date, date) TO authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS get_hpp_periode(date, date);
-- DROP VIEW IF EXISTS hpp_barang_masuk_harian_spv;
-- DROP VIEW IF EXISTS hpp_nilai_stok_harian_spv;
-- DROP TRIGGER IF EXISTS trg_fill_harga_snapshot ON surat_jalan_item;
-- DROP FUNCTION IF EXISTS fill_harga_snapshot();
-- ALTER TABLE surat_jalan_item DROP COLUMN IF EXISTS harga_snapshot;
