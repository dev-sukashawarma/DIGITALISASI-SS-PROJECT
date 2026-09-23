-- supabase/migrations/20260923182000_invarian_faktor_bahan.sql
-- Spec 2026-09-23 K4 + K10.1: invarian faktor ditegakkan server, bukan tangan;
-- satu helper peran untuk semua RPC master.

CREATE OR REPLACE FUNCTION public._peran_master(p_lingkup text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = v_uid AND status = 'active';
  IF p_lingkup = 'data' AND v_role IN ('admin', 'owner') THEN
    RETURN v_uid;
  END IF;
  IF p_lingkup = 'harga' AND v_role IN ('admin', 'owner', 'purchasing') THEN
    RETURN v_uid;
  END IF;
  RAISE EXCEPTION 'Peran % tidak berhak mengubah master bahan baku (lingkup %)', COALESCE(v_role, '-'), p_lingkup
    USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public._peran_master(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._kanon_satuan(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- Sama dengan kanonisasi hitung_faktor_po(): lower + trim + 'bks' -> 'bungkus'.
  SELECT CASE WHEN x = 'bks' THEN 'bungkus' ELSE x END
    FROM (SELECT NULLIF(lower(btrim(COALESCE(p, ''))), '') AS x) s;
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
  IF NEW.satuan_distribusi IS NOT NULL
     AND (v_satuan_berubah OR NEW.satuan_distribusi IS DISTINCT FROM OLD.satuan_distribusi)
     AND NOT (public._kanon_satuan(NEW.satuan_distribusi) = ANY (v_tingkat)) THEN
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

DROP TRIGGER IF EXISTS trg_bahan_baku_00_tegakkan_faktor ON public.bahan_baku;
CREATE TRIGGER trg_bahan_baku_00_tegakkan_faktor BEFORE INSERT OR UPDATE ON public.bahan_baku
  FOR EACH ROW EXECUTE FUNCTION public.bahan_baku_tegakkan_faktor();

CREATE OR REPLACE FUNCTION public.bahan_baku_harga_samakan_kemasan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(b.faktor_tampilan, 1), COALESCE(b.satuan_kecil, b.satuan)
    INTO NEW.kemasan_qty, NEW.kemasan_satuan
    FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbh_00_samakan_kemasan ON public.bahan_baku_harga;
CREATE TRIGGER trg_bbh_00_samakan_kemasan BEFORE INSERT OR UPDATE ON public.bahan_baku_harga
  FOR EACH ROW EXECUTE FUNCTION public.bahan_baku_harga_samakan_kemasan();

-- Rapikan pelanggar yang ada: sentuh baris supaya trigger menurunkan faktor_konversi.
-- faktor_tampilan TIDAK berubah, jadi saldo & ledger tak bergeser.
-- Dibungkus DO supaya set_config lokal dan UPDATE pasti satu transaksi
-- (alat apply bisa menjalankan tiap statement sebagai transaksi sendiri).
DO $$
BEGIN
  PERFORM set_config('app.alasan', 'Invarian faktor (spec 2026-09-23 K4): faktor_konversi diturunkan dari faktor_tampilan / faktor_tengah', true);
  UPDATE public.bahan_baku b
     SET faktor_konversi = b.faktor_konversi
   WHERE b.faktor_konversi IS DISTINCT FROM
         CASE WHEN NULLIF(btrim(b.satuan_kecil), '') IS NULL THEN 1
              WHEN NULLIF(btrim(b.satuan_tengah), '') IS NOT NULL THEN b.faktor_tampilan / b.faktor_tengah
              ELSE b.faktor_tampilan END;
END $$;
