-- 20260908230000_bahan_baku_faktor_po.sql
-- Menutup ranjau: satuan_po sudah terisi untuk 52 bahan aktif tetapi TIDAK ADA
-- kolom yang menyimpan konversinya ke satuan kecil. Untuk FOIL / MIE /
-- PLASTIK BESAR, satuan_po bukan satuan master (48x / 40x / 5x), jadi begitu
-- ada yang mewirekan satuan_po ke form PO sebagai label, qty masuk berlipat.
--
-- Catatan timestamp: brief Task 2 semula menargetkan slot 20260908180000,
-- tapi slot itu sudah dipakai `20260908180000_koreksi_harga_beku_saos_sejak_1sep.sql`
-- (migration paralel dari sesi lain di hari yang sama). Migration ini digeser
-- ke 20260908230000 (slot kosong berikutnya) agar tidak tabrakan version di
-- supabase_migrations.schema_migrations. Isi SQL identik dengan brief.
--
-- Aditif & idempoten. Tidak menyentuh harga, ledger, atau fungsi yang ada.

ALTER TABLE public.bahan_baku
  ADD COLUMN IF NOT EXISTS faktor_po numeric;

COMMENT ON COLUMN public.bahan_baku.faktor_po IS
  'Jumlah satuan KECIL dalam 1 satuan_po. Turunan dari satuan_po vs '
  'satuan/satuan_tengah/satuan_kecil. NULL = label satuan_po tidak dikenal '
  '(sengaja: kesalahan harus terlihat, jangan diasumsikan 1).';

-- Aturan turunan, kembar dengan hitungFaktorPo() di
-- apps/admin-dashboard/src/lib/satuanPo.ts
CREATE OR REPLACE FUNCTION public.hitung_faktor_po(
  p_satuan          text,
  p_satuan_po       text,
  p_satuan_tengah   text,
  p_faktor_tengah   numeric,
  p_satuan_kecil    text,
  p_faktor_tampilan numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  WITH c AS (
    SELECT
      NULLIF(lower(btrim(coalesce(p_satuan_po, ''))),      '-') AS po,
      NULLIF(lower(btrim(coalesce(p_satuan, ''))),         '-') AS besar,
      NULLIF(lower(btrim(coalesce(p_satuan_tengah, ''))),  '-') AS tengah,
      NULLIF(lower(btrim(coalesce(p_satuan_kecil, ''))),   '-') AS kecil
  ), n AS (
    SELECT
      CASE WHEN po     = 'bks' THEN 'bungkus' ELSE NULLIF(po, '')     END AS po,
      CASE WHEN besar  = 'bks' THEN 'bungkus' ELSE NULLIF(besar, '')  END AS besar,
      CASE WHEN tengah = 'bks' THEN 'bungkus' ELSE NULLIF(tengah, '') END AS tengah,
      CASE WHEN kecil  = 'bks' THEN 'bungkus' ELSE NULLIF(kecil, '')  END AS kecil
    FROM c
  )
  SELECT CASE
    WHEN n.po IS NULL THEN NULL
    WHEN n.po = n.besar THEN
      CASE
        WHEN n.kecil IS NULL THEN 1
        WHEN coalesce(p_faktor_tampilan, 0) > 0 THEN p_faktor_tampilan
        ELSE NULL
      END
    WHEN n.tengah IS NOT NULL AND n.po = n.tengah THEN
      CASE
        WHEN coalesce(p_faktor_tampilan, 0) > 0 AND coalesce(p_faktor_tengah, 0) > 0
          THEN p_faktor_tampilan / p_faktor_tengah
        ELSE NULL
      END
    WHEN n.kecil IS NOT NULL AND n.po = n.kecil THEN 1
    ELSE NULL
  END
  FROM n;
$$;

-- Seed nilai awal
UPDATE public.bahan_baku b
SET faktor_po = public.hitung_faktor_po(
      b.satuan, b.satuan_po, b.satuan_tengah, b.faktor_tengah,
      b.satuan_kecil, b.faktor_tampilan)
WHERE b.faktor_po IS DISTINCT FROM public.hitung_faktor_po(
      b.satuan, b.satuan_po, b.satuan_tengah, b.faktor_tengah,
      b.satuan_kecil, b.faktor_tampilan);

-- Jaga agar tidak basi saat satuan bahan diubah (FOIL berubah 8 Sep 2026)
CREATE OR REPLACE FUNCTION public.bahan_baku_sync_faktor_po()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.faktor_po := public.hitung_faktor_po(
    NEW.satuan, NEW.satuan_po, NEW.satuan_tengah, NEW.faktor_tengah,
    NEW.satuan_kecil, NEW.faktor_tampilan);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bahan_baku_faktor_po ON public.bahan_baku;
CREATE TRIGGER trg_bahan_baku_faktor_po
  BEFORE INSERT OR UPDATE OF satuan, satuan_po, satuan_tengah,
                             faktor_tengah, satuan_kecil, faktor_tampilan
  ON public.bahan_baku
  FOR EACH ROW EXECUTE FUNCTION public.bahan_baku_sync_faktor_po();

ALTER TABLE public.bahan_baku
  DROP CONSTRAINT IF EXISTS bahan_baku_faktor_po_positif;
ALTER TABLE public.bahan_baku
  ADD CONSTRAINT bahan_baku_faktor_po_positif
  CHECK (faktor_po IS NULL OR faktor_po > 0);

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_bahan_baku_faktor_po ON public.bahan_baku;
-- DROP FUNCTION IF EXISTS public.bahan_baku_sync_faktor_po();
-- DROP FUNCTION IF EXISTS public.hitung_faktor_po(text,text,text,numeric,text,numeric);
-- ALTER TABLE public.bahan_baku DROP CONSTRAINT IF EXISTS bahan_baku_faktor_po_positif;
-- ALTER TABLE public.bahan_baku DROP COLUMN IF EXISTS faktor_po;
