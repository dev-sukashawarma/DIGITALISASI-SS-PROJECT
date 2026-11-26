-- ============================================================================
-- Migration: Pulihkan Mesin Status & RPC Top-Up Petty Cash Tanpa AM
-- ============================================================================
-- Memulihkan definisi fungsi mesin status (`petty_cash_enforce_flow`),
-- konfirmasi leader (`leader_forward_funds`), penonaktifan RPC AM lama, dan
-- push notifikasi tanpa emoji yang sempat tertimpa migrasi out-of-band
-- 20261125154001 agar selaras penuh dengan 20261125120000 dan 20261126100000.
-- ============================================================================

SET LOCAL lock_timeout = '10s';

-- 1. Mesin status petty_cash_topups: lahir langsung di forwarded_to_finance,
--    dan dari approved_by_finance langsung dikonfirmasi leader ke forwarded_by_leader.
CREATE OR REPLACE FUNCTION public.petty_cash_enforce_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, '') <> 'forwarded_to_finance' THEN
      RAISE EXCEPTION 'Pengajuan petty cash harus lahir dengan status forwarded_to_finance (dicoba: %). Auto-approve dilarang.', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) NOT IN (
    ('forwarded_to_finance', 'approved_by_finance'),
    ('forwarded_to_finance', 'rejected'),
    ('approved_by_finance',  'forwarded_by_leader'),
    ('forwarded_by_leader',  'completed')
  ) THEN
    RAISE EXCEPTION 'Transisi status petty cash tidak sah: % -> %. Pengajuan hanya bisa ditolak sebelum dana dicairkan.', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'approved_by_finance' AND length(btrim(COALESCE(NEW.proof_of_transfer_url, ''))) = 0 THEN
    RAISE EXCEPTION 'Bukti transfer/serah uang wajib dilampirkan sebelum pengajuan ditandai dicairkan';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Konfirmasi penerimaan dana oleh Leader langsung dari approved_by_finance -> forwarded_by_leader.
CREATE OR REPLACE FUNCTION public.leader_forward_funds(p_topup_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.outlet_staff
  WHERE id = auth.uid() AND status = 'active' AND COALESCE(is_active, true);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Tidak berwenang mengonfirmasi penerimaan dana petty cash';
  END IF;

  SELECT outlet_id INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND OR v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang mengonfirmasi petty cash outlet ini';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_topup.outlet_id::TEXT, 0));

  SELECT status, finance_approved_by INTO v_topup
  FROM public.petty_cash_topups WHERE id = p_topup_id FOR UPDATE;
  IF v_topup.status IS DISTINCT FROM 'approved_by_finance' THEN
    RAISE EXCEPTION 'Dana belum ditransfer Finance atau sudah dikonfirmasi (status: %)', v_topup.status;
  END IF;
  IF v_topup.finance_approved_by = auth.uid() THEN
    RAISE EXCEPTION 'Tidak berwenang: yang mencairkan dana tidak boleh mengonfirmasi penerimaannya sendiri';
  END IF;

  UPDATE public.petty_cash_topups
  SET
    status = 'forwarded_by_leader',
    leader_forwarded_by = auth.uid(),
    leader_forwarded_at = NOW()
  WHERE id = p_topup_id;
END;
$function$;

-- 3. Nonaktifkan kembali seluruh RPC tahap Area Manager / Korlap lama.
CREATE OR REPLACE FUNCTION public.area_manager_process_petty_cash(p_topup_id uuid, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.area_manager_forward_funds(p_topup_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.finance_forward_funds(p_topup_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.korlap_process_petty_cash(p_topup_id uuid, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.korlap_forward_funds(p_topup_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_petty_cash_topup(p_topup_id uuid, p_action text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance.';
END;
$function$;

-- 4. Push saat Finance selesai mentransfer (approved_by_finance) -> langsung ke Leader pengaju.
CREATE OR REPLACE FUNCTION public.trigger_petty_cash_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url          TEXT;
  v_key          TEXT;
  v_outlet_nama  TEXT;
  v_nominal_fmt  TEXT;
  v_target_staff RECORD;
  v_body         TEXT;
  v_title        TEXT;
BEGIN
  IF NOT (TG_OP = 'UPDATE' AND NEW.status = 'approved_by_finance'
          AND OLD.status IS DISTINCT FROM 'approved_by_finance') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;

    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RAISE WARNING 'Push petty cash dilewati: secret push_webhook_url/fcm_webhook_secret belum ada di vault.';
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;
    v_outlet_nama := COALESCE(v_outlet_nama, 'Outlet');
    v_nominal_fmt := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999'), ',', '.');
    v_title := 'Petty Cash Sudah Ditransfer';
    v_body := 'Petty cash ' || v_outlet_nama || ' Rp ' || v_nominal_fmt
           || ' sudah ditransfer Finance. Tekan "Dana diterima & masuk laci" setelah uang masuk laci.';

    FOR v_target_staff IN
      SELECT NEW.created_by AS id WHERE NEW.created_by IS NOT NULL
      UNION
      SELECT DISTINCT os.id
      FROM public.outlet_staff os
      LEFT JOIN public.staff_outlets so ON so.staff_id = os.id
      WHERE NEW.created_by IS NULL
        AND (os.outlet_id = NEW.outlet_id OR so.outlet_id = NEW.outlet_id)
        AND os.role = 'leader'
        AND os.status = 'active'
        AND COALESCE(os.is_active, true)
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object(
          'user_id', v_target_staff.id,
          'app', 'leader',
          'type', 'petty_cash_urgent',
          'title', v_title,
          'body', v_body,
          'url', 'leader_petty_cash'
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push notifikasi petty cash: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 5. Perbarui batal_otomatis_topup_petty_cash_lewat_batas tanpa emoji & dukung leader multi-outlet (staff_outlets).
CREATE OR REPLACE FUNCTION public.batal_otomatis_topup_petty_cash_lewat_batas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
  v_url TEXT;
  v_key TEXT;
  v_outlet_nama TEXT;
  v_nominal_fmt TEXT;
  v_target RECORD;
  v_alasan CONSTANT TEXT := 'Dibatalkan otomatis oleh sistem karena melewati batas pukul 16:00 WIB';
  v_desc_baru TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_key := NULL;
  END;

  FOR v_row IN
    SELECT id, outlet_id, amount, description, created_by
    FROM public.petty_cash_topups
    WHERE status = 'forwarded_to_finance'
    FOR UPDATE SKIP LOCKED
  LOOP
    v_desc_baru := CASE
      WHEN COALESCE(v_row.description, '') LIKE '%[Ditolak Finance:%' THEN v_row.description
      ELSE COALESCE(NULLIF(btrim(v_row.description), ''), 'Pengajuan Top Up Petty Cash')
           || E'\n\n[Ditolak Finance: ' || v_alasan || ']'
    END;

    UPDATE public.petty_cash_topups
    SET
      status = 'rejected',
      finance_approved_by = NULL,
      description = v_desc_baru
    WHERE id = v_row.id
      AND status = 'forwarded_to_finance';

    v_count := v_count + 1;

    IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
      BEGIN
        SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = v_row.outlet_id;
        v_outlet_nama := COALESCE(v_outlet_nama, 'Outlet');
        v_nominal_fmt := replace(to_char(COALESCE(v_row.amount, 0), 'FM999,999,999,999'), ',', '.');

        FOR v_target IN
          SELECT v_row.created_by AS id WHERE v_row.created_by IS NOT NULL
          UNION
          SELECT DISTINCT os.id
          FROM public.outlet_staff os
          LEFT JOIN public.staff_outlets so ON so.staff_id = os.id
          WHERE v_row.created_by IS NULL
            AND (os.outlet_id = v_row.outlet_id OR so.outlet_id = v_row.outlet_id)
            AND os.role = 'leader'
            AND os.status = 'active'
            AND COALESCE(os.is_active, true)
        LOOP
          PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_key
            ),
            body := jsonb_build_object(
              'user_id', v_target.id,
              'app', 'leader',
              'type', 'petty_cash_cancelled',
              'title', 'Top Up Petty Cash Dibatalkan Otomatis',
              'body', 'Pengajuan top up ' || v_outlet_nama || ' Rp ' || v_nominal_fmt
                   || ' dibatalkan otomatis oleh sistem karena melewati pukul 16:00 WIB. Silakan ajukan kembali besok pukul 09:00–16:00 WIB.',
              'url', 'leader_petty_cash'
            )
          );
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Push auto-batal topup % gagal: %', v_row.id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.batal_otomatis_topup_petty_cash_lewat_batas() FROM PUBLIC, anon, authenticated;

-- 6. Riwayat approval petty_cash_topups tanpa cabang serah_am lama.
CREATE OR REPLACE FUNCTION public.trg_approval_log_petty_cash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_keputusan text;
  v_pelaku uuid;
  v_outlet text;
BEGIN
  BEGIN
    IF OLD.status = 'forwarded_to_finance' AND NEW.status = 'approved_by_finance' THEN
      v_keputusan := 'setuju';
      v_pelaku := coalesce(auth.uid(), NEW.finance_approved_by);
    ELSIF OLD.status = 'forwarded_to_finance' AND NEW.status = 'rejected' THEN
      v_keputusan := 'tolak';
      v_pelaku := coalesce(auth.uid(), NEW.finance_approved_by);
    ELSE
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    INSERT INTO public.approval_log (
      jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut
    )
    VALUES (
      'petty_cash',
      v_keputusan,
      NEW.id,
      v_outlet,
      left(NEW.description, 200),
      NEW.amount,
      CASE WHEN v_keputusan = 'tolak' THEN public.approval_log_ambil_alasan(NEW.description, 'Ditolak Finance:') END,
      v_pelaku,
      now(),
      now()
    )
    ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log petty_cash gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
