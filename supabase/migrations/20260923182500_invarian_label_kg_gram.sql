-- supabase/migrations/20260923182500_invarian_label_kg_gram.sql
-- Perbaikan review Task 3 (ruling controller, fix round 1) atas 20260923182000
-- (sudah applied & distempel, jadi TIDAK disunting — fungsi di-CREATE OR REPLACE di sini):
--
-- 1. satuan_distribusi = 'kg' SAH bila satuan_kecil = 'gram'. getDistribusiFactor()
--    (apps/stok/src/lib/format/compositeUnit.ts) memetakan dist 'kg' + kecil 'gram'
--    ke faktor_tampilan / 1000, dan SAOS CABE / SAOS SAMYANG / SAOS TOMAT KOMPAN
--    bergantung padanya. Pengecualian ini SENGAJA TIDAK berlaku untuk satuan_po:
--    hitung_faktor_po() tak punya aturan kg, sehingga 'kg' di sana memberi faktor_po NULL.
-- 2. _kanon_satuan kini benar-benar setara kanonisasi hitung_faktor_po():
--    '-' dan '' diperlakukan sebagai NULL (sebelumnya '-' lolos sebagai label '-').
--
-- Selebihnya identik dengan versi 20260923182000.

CREATE OR REPLACE FUNCTION public._kanon_satuan(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- Sama dengan kanonisasi hitung_faktor_po(): lower + trim, '-' dan '' -> NULL,
  -- 'bks' -> 'bungkus'.
  SELECT CASE WHEN x = 'bks' THEN 'bungkus' ELSE NULLIF(x, '') END
    FROM (SELECT NULLIF(lower(btrim(COALESCE(p, ''))), '-') AS x) s;
$$;

CREATE OR REPLACE FUNCTION public.bahan_baku_tegakkan_faktor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tingkat text[];
  v_satuan_berubah boolean;
BEGIN
  NEW.satuan        := btrim(NEW.satuan);
  NEW.satuan_tengah := NULLIF(btrim(NEW.satuan_tengah), '');
  NEW.satuan_kecil  := NULLIF(btrim(NEW.satuan_kecil), '');

  IF NEW.satuan_kecil IS NULL THEN
    IF NEW.satuan_tengah IS NOT NULL THEN
      RAISE EXCEPTION 'Bahan %: satuan tengah butuh satuan kecil', NEW.nama USING ERRCODE = '23514';
    END IF;
    NEW.faktor_tengah   := NULL;
    NEW.faktor_tampilan := NULL;
    NEW.faktor_konversi := 1;
  ELSE
    IF COALESCE(NEW.faktor_tampilan, 0) <= 0 OR NEW.faktor_tampilan = 'NaN'::numeric THEN
      RAISE EXCEPTION 'Bahan %: isi satuan kecil per satuan besar wajib > 0', NEW.nama USING ERRCODE = '23514';
    END IF;
    IF NEW.satuan_tengah IS NULL THEN
      NEW.faktor_tengah   := NULL;
      NEW.faktor_konversi := NEW.faktor_tampilan;
    ELSE
      IF COALESCE(NEW.faktor_tengah, 0) <= 0 OR NEW.faktor_tengah = 'NaN'::numeric THEN
        RAISE EXCEPTION 'Bahan %: isi satuan tengah per satuan besar wajib > 0', NEW.nama USING ERRCODE = '23514';
      END IF;
      NEW.faktor_konversi := NEW.faktor_tampilan / NEW.faktor_tengah;
    END IF;
  END IF;

  v_satuan_berubah := TG_OP = 'INSERT'
    OR NEW.satuan IS DISTINCT FROM OLD.satuan
    OR NEW.satuan_tengah IS DISTINCT FROM OLD.satuan_tengah
    OR NEW.satuan_kecil IS DISTINCT FROM OLD.satuan_kecil;

  -- Label PO & distribusi wajib salah satu tingkat (getDistribusiFactor() diam-diam
  -- jatuh ke 1 bila tak cocok — kelas bug 48x FOIL). Hanya dicek saat label atau
  -- tingkatnya berubah, supaya data lama tak mengunci edit kolom lain.
  v_tingkat := array_remove(ARRAY[public._kanon_satuan(NEW.satuan), public._kanon_satuan(NEW.satuan_tengah),
                                  public._kanon_satuan(NEW.satuan_kecil)], NULL);
  IF NEW.satuan_po IS NOT NULL
     AND (v_satuan_berubah OR NEW.satuan_po IS DISTINCT FROM OLD.satuan_po)
     AND NOT (public._kanon_satuan(NEW.satuan_po) = ANY (v_tingkat)) THEN
    RAISE EXCEPTION 'Bahan %: satuan PO "%" bukan salah satu tingkat (%)', NEW.nama, NEW.satuan_po,
      array_to_string(v_tingkat, '/') USING ERRCODE = '23514';
  END IF;
  -- Distribusi: selain tingkat, 'kg' sah bila satuan kecil 'gram' (pemetaan implisit
  -- getDistribusiFactor(): faktor_tampilan / 1000). Tidak berlaku untuk satuan_po di atas.
  IF NEW.satuan_distribusi IS NOT NULL
     AND (v_satuan_berubah OR NEW.satuan_distribusi IS DISTINCT FROM OLD.satuan_distribusi)
     AND NOT (public._kanon_satuan(NEW.satuan_distribusi) = ANY (v_tingkat)
              OR (public._kanon_satuan(NEW.satuan_distribusi) = 'kg'
                  AND public._kanon_satuan(NEW.satuan_kecil) = 'gram')) THEN
    RAISE EXCEPTION 'Bahan %: satuan distribusi "%" bukan salah satu tingkat (%)', NEW.nama, NEW.satuan_distribusi,
      array_to_string(v_tingkat, '/') USING ERRCODE = '23514';
  END IF;

  -- Mengubah faktor penuh bahan ber-riwayat stok mengubah arti qty di dokumen
  -- berjalan & saldo skala besar — hanya lewat prosedur Ganti Satuan (Tahap 3).
  IF TG_OP = 'UPDATE'
     AND NEW.faktor_tampilan IS DISTINCT FROM OLD.faktor_tampilan
     AND COALESCE(current_setting('app.ganti_satuan', true), '') <> 'on'
     AND (EXISTS (SELECT 1 FROM public.ledger_stok WHERE bahan_baku_id = NEW.id)
          OR EXISTS (SELECT 1 FROM public.stok_balance WHERE bahan_baku_id = NEW.id AND saldo <> 0)) THEN
    RAISE EXCEPTION 'Bahan % sudah punya riwayat stok; isi satuannya hanya bisa diubah lewat Ganti Satuan', NEW.nama;
  END IF;

  RETURN NEW;
END;
$$;
