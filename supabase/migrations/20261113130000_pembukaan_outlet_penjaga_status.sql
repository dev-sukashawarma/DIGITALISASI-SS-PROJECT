-- Wizard Pembukaan Outlet — penjaga di DB (temuan review C1 & I2).
--
-- C1: trigger lama sync_outlet_status_active mengubah tulisan is_active=true
--     menjadi status='active'. Beberapa penulis di luar wizard menulis is_active
--     (absensi pengaturan saveOutletException & saveGlobalConfig — yang terakhir
--     ke SEMUA outlet — serta form cadangan POS Admin), sehingga outlet Persiapan
--     bisa aktif tanpa Go-Live: tanpa checklist, tanpa seed stok, tanpa tanggal
--     mulai mitra. Penjaga ini menahan status Persiapan kecuali perubahan datang
--     dari go_live_outlet / batalkan_pembukaan_outlet (GUC app.pembukaan_outlet).
--     SENGAJA diam (bukan RAISE): saveGlobalConfig menulis ke semua outlet, dan
--     galat akan menggagalkan simpan setelan absensi seluruh outlet.
--     Nama trg_zz_* WAJIB: trigger BEFORE berjalan urut nama, dan penjaga harus
--     melihat hasil akhir trg_sync_outlet_status_active.
-- I2: mengganti jenis Mitra → lain meninggalkan investasi, aturan RAB, dan akun
--     mitra (outlet tetap terhitung mitra lewat penanda investasi). Ditolak.

CREATE OR REPLACE FUNCTION public.outlets_jaga_persiapan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status IS DISTINCT FROM 'pending'
     AND coalesce(current_setting('app.pembukaan_outlet', true), '') <> 'on' THEN
    RAISE NOTICE 'Outlet % masih Persiapan: status hanya berubah lewat Go-Live atau Batalkan pembukaan', OLD.name;
    NEW.status := 'pending';
    NEW.is_active := false;
    NEW.deleted_at := OLD.deleted_at;
  END IF;

  IF OLD.type = 'mitra' AND NEW.type IS DISTINCT FROM OLD.type AND (
       EXISTS (SELECT 1 FROM public.mitra_investments WHERE outlet_id = OLD.id)
    OR EXISTS (SELECT 1 FROM public.rab_outlet_otomatis WHERE outlet_id = OLD.id)
    OR EXISTS (SELECT 1 FROM public.mitra_profiles WHERE OLD.id = ANY (outlet_ids))
  ) THEN
    RAISE EXCEPTION 'Jenis outlet tidak bisa diubah: outlet masih punya data mitra (investasi, masa RAB, atau akun mitra)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_outlets_jaga_persiapan ON public.outlets;
CREATE TRIGGER trg_zz_outlets_jaga_persiapan
  BEFORE UPDATE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.outlets_jaga_persiapan();
