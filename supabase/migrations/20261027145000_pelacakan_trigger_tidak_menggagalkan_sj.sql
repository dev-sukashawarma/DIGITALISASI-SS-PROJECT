-- =============================================================================
-- Trigger pelacakan di surat_jalan tidak boleh pernah menggagalkan perubahan
-- status SJ (verifikasi outlet, validasi pusat, batal) — alur stok yang sudah
-- berjalan. Seluruh isi dibungkus subtransaksi: bila galat (termasuk deadlock),
-- perubahan pelacakan saja yang dibatalkan dan SJ tetap tersimpan.
-- Uji: supabase/verifikasi/pelacakan_driver/t6_tidak_mengganggu.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pelacakan_sinkron_sj()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pid uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('diterima_sebagian','diterima_lengkap','selesai','dibatalkan') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT perjalanan_id INTO v_pid FROM public.driver_perjalanan_stop
     WHERE surat_jalan_id = NEW.id AND status = 'menunggu';
    IF v_pid IS NULL THEN
      RETURN NEW;
    END IF;

    -- Kunci perjalanan dulu, baru stop — urutan sama dengan RPC driver.
    PERFORM 1 FROM public.driver_perjalanan WHERE id = v_pid FOR UPDATE;

    IF NEW.status = 'dibatalkan' THEN
      UPDATE public.driver_perjalanan_stop SET status = 'dibatalkan'
       WHERE surat_jalan_id = NEW.id AND status = 'menunggu';
    ELSE
      UPDATE public.driver_perjalanan_stop
         SET status = 'tiba', tiba_at = now(), tiba_sumber = 'verifikasi_outlet'
       WHERE surat_jalan_id = NEW.id AND status = 'menunggu';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.driver_perjalanan_stop
                    WHERE perjalanan_id = v_pid AND status = 'menunggu') THEN
      PERFORM public._pelacakan_tutup_perjalanan(v_pid, 'selesai');
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'pelacakan_sinkron_sj dilewati untuk SJ %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
