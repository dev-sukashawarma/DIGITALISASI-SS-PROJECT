-- Tutup rekening lama di level database: transaksi BARU tidak boleh masuk ke lokasi kas
-- yang nonaktif, lewat jalur apa pun (RPC, tulis langsung, bot/alat luar ber-service-role).
-- Pemicu: sejak 4 Nov 2026 jalur "Setoran Gabungan AM Binaan" (di luar repo) menulis
-- langsung ke rekening lama BCA 48523399425 walau sudah nonaktif.
--
-- Yang DITOLAK : INSERT ke lokasi nonaktif; UPDATE yang MEMINDAHKAN baris ke lokasi nonaktif.
-- Yang TETAP BOLEH: mengubah status/catatan baris lama yang sudah ada di lokasi nonaktif
--   (void, rekonsiliasi), dan memindahkan baris KELUAR dari lokasi nonaktif.

CREATE OR REPLACE FUNCTION public.cash_tolak_lokasi_nonaktif()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aktif boolean; v_label text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cash_location_id IS NOT DISTINCT FROM OLD.cash_location_id THEN
    RETURN NEW;
  END IF;
  SELECT is_active, label INTO v_aktif, v_label FROM public.cash_location WHERE id = NEW.cash_location_id;
  IF v_aktif IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Rekening/kas "%" sudah nonaktif — pilih rekening/kas aktif', coalesce(v_label, NEW.cash_location_id::text)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.cash_tolak_lokasi_nonaktif() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cash_00_tolak_lokasi_nonaktif ON public.cash_transaction;
CREATE TRIGGER trg_cash_00_tolak_lokasi_nonaktif
  BEFORE INSERT OR UPDATE OF cash_location_id ON public.cash_transaction
  FOR EACH ROW EXECUTE FUNCTION public.cash_tolak_lokasi_nonaktif();
