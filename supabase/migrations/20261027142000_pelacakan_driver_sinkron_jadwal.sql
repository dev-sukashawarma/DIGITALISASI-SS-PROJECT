-- =============================================================================
-- Pelacakan driver distribusi — sinkron status SJ, status antar untuk outlet,
-- penutupan otomatis & retensi jejak.
-- Spec: docs/superpowers/specs/2026-10-27-pelacakan-driver-design.md (§6.3–§6.5)
--
-- Trigger di surat_jalan hanya menulis tabel pelacakan; tidak menyentuh
-- ledger_stok / stok_balance / status SJ.
-- =============================================================================

-- ---------------------------------------------------------------- sinkron SJ
CREATE OR REPLACE FUNCTION public.pelacakan_sinkron_sj()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pid uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('diterima_sebagian','diterima_lengkap','selesai') THEN
    UPDATE public.driver_perjalanan_stop
       SET status = 'tiba', tiba_at = now(), tiba_sumber = 'verifikasi_outlet'
     WHERE surat_jalan_id = NEW.id AND status = 'menunggu'
    RETURNING perjalanan_id INTO v_pid;
  ELSIF NEW.status = 'dibatalkan' THEN
    UPDATE public.driver_perjalanan_stop
       SET status = 'dibatalkan'
     WHERE surat_jalan_id = NEW.id AND status = 'menunggu'
    RETURNING perjalanan_id INTO v_pid;
  END IF;

  IF v_pid IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.driver_perjalanan_stop
                      WHERE perjalanan_id = v_pid AND status = 'menunggu') THEN
    PERFORM public._pelacakan_tutup_perjalanan(v_pid, 'selesai');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pelacakan_sinkron_sj() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pelacakan_sinkron_sj ON public.surat_jalan;
CREATE TRIGGER trg_pelacakan_sinkron_sj
  AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW EXECUTE FUNCTION public.pelacakan_sinkron_sj();

-- ---------------------------------------------------------------- status untuk outlet
-- Tidak pernah mengembalikan koordinat / jarak.
CREATE OR REPLACE FUNCTION public.status_antar_sj(p_sj_id uuid)
RETURNS TABLE(dilacak boolean, nama_driver text, berangkat_at timestamptz, status_stop text,
              tiba_at timestamptz, tiba_sumber text, outlet_sebelum int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.surat_jalan sj
                  WHERE sj.id = p_sj_id
                    AND sj.outlet_id IN (SELECT public.accessible_outlet_ids())) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, st.name, p.berangkat_at, s.status, s.tiba_at, s.tiba_sumber,
         (SELECT count(*)::int FROM public.driver_perjalanan_stop s2
           WHERE s2.perjalanan_id = s.perjalanan_id AND s2.status = 'menunggu' AND s2.urutan < s.urutan)
    FROM public.driver_perjalanan_stop s
    JOIN public.driver_perjalanan p ON p.id = s.perjalanan_id
    JOIN public.outlet_staff st ON st.id = p.driver_id
   WHERE s.surat_jalan_id = p_sj_id AND s.status <> 'dibatalkan'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz, NULL::text, NULL::timestamptz, NULL::text, NULL::int;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.status_antar_sj(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_antar_sj(uuid) TO authenticated;

-- ---------------------------------------------------------------- tutup otomatis
-- Menutup perjalanan berjalan bila jam WIB p_sekarang >= batas_tutup_wib,
-- atau perjalanan berangkat di hari WIB sebelumnya (lupa ditutup).
CREATE OR REPLACE FUNCTION public.pelacakan_tutup_otomatis(p_sekarang timestamptz DEFAULT now())
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batas time := (public._pelacakan_pengaturan()->>'batas_tutup_wib')::time;
  v_wib   timestamp := p_sekarang AT TIME ZONE 'Asia/Jakarta';
  v_n     int := 0;
  r       record;
BEGIN
  FOR r IN SELECT id FROM public.driver_perjalanan
            WHERE status = 'berjalan'
              AND (v_wib::time >= v_batas
                   OR (berangkat_at AT TIME ZONE 'Asia/Jakarta')::date < v_wib::date)
            FOR UPDATE LOOP
    PERFORM public._pelacakan_tutup_perjalanan(r.id, 'ditutup_otomatis');
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ---------------------------------------------------------------- retensi
CREATE OR REPLACE FUNCTION public.pelacakan_retensi_jejak()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  DELETE FROM public.driver_lokasi_jejak
   WHERE direkam_at < now() - make_interval(days => (public._pelacakan_pengaturan()->>'retensi_hari')::int);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.pelacakan_tutup_otomatis(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pelacakan_retensi_jejak()             FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- jadwal (UTC)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('driver-tutup-perjalanan','driver-retensi-jejak');
END $$;
SELECT cron.schedule('driver-tutup-perjalanan', '*/15 * * * *', 'SELECT public.pelacakan_tutup_otomatis()');
SELECT cron.schedule('driver-retensi-jejak',    '40 20 * * *',  'SELECT public.pelacakan_retensi_jejak()');
