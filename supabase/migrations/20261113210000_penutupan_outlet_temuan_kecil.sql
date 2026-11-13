-- Wizard Penutupan Outlet — temuan kecil review akhir (M1, M3, M7).
-- Uji: supabase/verifikasi/penutupan_outlet/t5_temuan_kecil.sql
-- (M4 "status kosong" tidak diperbaiki: outlets.status sudah NOT NULL.)
--
-- M1: auto_verifikasi_surat_jalan melewati SJ ke outlet yang sudah tutup. SJ
--     itu tetap 'dikirim' sehingga langkah papan "Surat jalan beres" tetap merah
--     sampai Kitchen menyelesaikannya (batal / mutasi balik), alih-alih diam-diam
--     menambah stok ke outlet tutup jam 02:00.
-- M3: tutup_outlet & koreksi_tanggal_tutup mencatat masa RAB asli di detail log
--     ('rab_sampai_asli') sebelum memendekkannya; buka_kembali_outlet memulihkannya.
-- M7: penjaga outlet menahan app_enabled = true untuk outlet internal/mitra yang
--     sudah tutup (App Retail tak bisa menayangkannya lagi ke pelanggan).

-- M1 ------------------------------------------------------------------------
DO $$
DECLARE
  v_def  text := pg_get_functiondef('public.auto_verifikasi_surat_jalan(boolean)'::regprocedure);
  p_lama constant text := 'WHERE o.id = sj.outlet_id AND o.type = ''test'')';
  p_baru constant text := 'WHERE o.id = sj.outlet_id AND (o.type = ''test'' OR o.status = ''inactive''))';
BEGIN
  IF position(p_baru in v_def) > 0 THEN
    RAISE NOTICE 'auto_verifikasi_surat_jalan sudah ditambal, dilewati';
    RETURN;
  END IF;
  IF (length(v_def) - length(replace(v_def, p_lama, ''))) / length(p_lama) <> 1 THEN
    RAISE EXCEPTION 'Pola M1 tidak ketemu tepat sekali';
  END IF;
  EXECUTE replace(v_def, p_lama, p_baru);
END $$;

-- M7 ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outlets_jaga_penutupan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.type IN ('internal','mitra')
     AND OLD.status IN ('active','inactive')
     AND coalesce(current_setting('app.penutupan_outlet', true), '') <> 'on' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE NOTICE 'Outlet %: status aktif/nonaktif hanya berubah lewat Tutup Outlet atau Buka kembali', OLD.name;
      NEW.status      := OLD.status;
      NEW.is_active   := OLD.is_active;
      NEW.nonaktif_at := OLD.nonaktif_at;
      NEW.deleted_at  := OLD.deleted_at;
    END IF;
    IF OLD.status = 'inactive' AND NEW.app_enabled AND NOT coalesce(OLD.app_enabled, false) THEN
      RAISE NOTICE 'Outlet % sudah tutup: tidak bisa ditayangkan di aplikasi pelanggan', OLD.name;
      NEW.app_enabled := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- M3 ------------------------------------------------------------------------
-- Masa RAB asli terakhir yang tercatat sebelum dipendekkan oleh penutupan.
CREATE OR REPLACE FUNCTION public._penutupan_rab_asli(p_outlet_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (detail->>'rab_sampai_asli')::date
    FROM public.outlet_pembukaan_log
   WHERE outlet_id = p_outlet_id
     AND aksi IN ('ditutup','tanggal_tutup_dikoreksi','dibuka_kembali')
   ORDER BY dibuat_at DESC, id DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._penutupan_rab_asli(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tutup_outlet(p_outlet_id uuid, p_tanggal_terakhir date, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_promo    int;
  v_rab_asli date;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status = 'pending' THEN
    RAISE EXCEPTION 'Outlet masih Persiapan — pakai Batalkan pembukaan di menu Pembukaan Outlet';
  END IF;
  IF o.status = 'inactive' OR NOT o.is_active THEN
    RAISE EXCEPTION 'Outlet % sudah ditutup', o.name;
  END IF;
  PERFORM public._penutupan_cek_tanggal_alasan(o, p_tanggal_terakhir, p_alasan);

  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET status = 'inactive', is_active = false,
         nonaktif_at = (p_tanggal_terakhir + time '23:59:59') AT TIME ZONE 'Asia/Jakarta',
         alasan_tutup = btrim(p_alasan), ditutup_by = auth.uid(),
         app_enabled = false,
         penutupan_selesai_at = NULL, penutupan_selesai_by = NULL,
         updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  UPDATE public.outlet_promos SET is_active = false, updated_at = now()
   WHERE outlet_id = p_outlet_id AND is_active;
  GET DIAGNOSTICS v_promo = ROW_COUNT;

  SELECT max(berlaku_sampai) INTO v_rab_asli
    FROM public.rab_outlet_otomatis
   WHERE outlet_id = p_outlet_id AND berlaku_sampai > p_tanggal_terakhir;
  UPDATE public.rab_outlet_otomatis SET berlaku_sampai = greatest(berlaku_mulai, p_tanggal_terakhir)
   WHERE outlet_id = p_outlet_id AND berlaku_sampai > p_tanggal_terakhir;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'ditutup', btrim(p_alasan),
    jsonb_build_object('tanggal_terakhir', p_tanggal_terakhir, 'promo_dimatikan', v_promo,
                       'rab_sampai_asli', v_rab_asli));
END;
$$;

CREATE OR REPLACE FUNCTION public.koreksi_tanggal_tutup(p_outlet_id uuid, p_tanggal date, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_rab_asli date;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' THEN
    RAISE EXCEPTION 'Outlet % tidak sedang ditutup', o.name;
  END IF;
  PERFORM public._penutupan_cek_tanggal_alasan(o, p_tanggal, p_alasan);

  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET nonaktif_at = (p_tanggal + time '23:59:59') AT TIME ZONE 'Asia/Jakarta', updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  -- Masa RAB mengikuti tanggal tutup yang baru, tidak pernah melewati masa asli.
  v_rab_asli := coalesce(public._penutupan_rab_asli(p_outlet_id),
                         (SELECT max(berlaku_sampai) FROM public.rab_outlet_otomatis
                           WHERE outlet_id = p_outlet_id AND berlaku_sampai > p_tanggal));
  IF v_rab_asli IS NOT NULL THEN
    UPDATE public.rab_outlet_otomatis
       SET berlaku_sampai = greatest(berlaku_mulai, least(v_rab_asli, p_tanggal))
     WHERE outlet_id = p_outlet_id;
  END IF;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'tanggal_tutup_dikoreksi', btrim(p_alasan),
    jsonb_build_object('dari', to_char(o.nonaktif_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'), 'ke', p_tanggal,
                       'rab_sampai_asli', v_rab_asli));
END;
$$;

CREATE OR REPLACE FUNCTION public.buka_kembali_outlet(p_outlet_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_rab_asli date;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' THEN
    RAISE EXCEPTION 'Outlet % tidak sedang ditutup', o.name;
  END IF;
  IF length(btrim(coalesce(p_alasan, ''))) < 10 THEN
    RAISE EXCEPTION 'Alasan wajib diisi, minimal 10 karakter';
  END IF;

  -- app_enabled & promo sengaja TIDAK dinyalakan otomatis.
  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET status = 'active', is_active = true,
         alasan_tutup = NULL, ditutup_by = NULL,
         penutupan_selesai_at = NULL, penutupan_selesai_by = NULL,
         updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  -- Pulihkan masa RAB yang dipendekkan saat tutup.
  v_rab_asli := public._penutupan_rab_asli(p_outlet_id);
  IF v_rab_asli IS NOT NULL THEN
    UPDATE public.rab_outlet_otomatis SET berlaku_sampai = v_rab_asli WHERE outlet_id = p_outlet_id;
  END IF;

  DELETE FROM public.outlet_penutupan_centang WHERE outlet_id = p_outlet_id;

  -- rab_sampai_asli NULL di log ini menandai masa RAB sudah dipulihkan.
  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dibuka_kembali', btrim(p_alasan),
    jsonb_build_object('nonaktif_at_sebelumnya', o.nonaktif_at, 'alasan_tutup_sebelumnya', o.alasan_tutup,
                       'rab_dipulihkan_ke', v_rab_asli, 'rab_sampai_asli', NULL));
END;
$$;
