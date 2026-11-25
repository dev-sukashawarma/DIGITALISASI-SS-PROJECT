-- Pengajuan petty cash langsung ke Finance, tanpa Area Manager (keputusan owner 25 Nov 2026).
-- Spec: docs/superpowers/specs/2026-11-25-petty-cash-tanpa-am-design.md
--
-- Alur: leader ajukan (forwarded_to_finance) -> Finance transfer + bukti wajib
-- (approved_by_finance) -> leader konfirmasi "dana diterima & masuk laci"
-- (forwarded_by_leader; saldo POS bertambah). Nama status lama dipertahankan
-- supaya get_petty_cash_snapshot & laporan tidak berubah.
-- Uji: supabase/verifikasi/petty_cash_tanpa_am/t1_alur.sql

-- 1. Pindahkan pengajuan yang sedang di tahap AM (per 25 Nov: 0 baris).
ALTER TABLE public.petty_cash_topups DISABLE TRIGGER trg_petty_cash_enforce_flow_update;
UPDATE public.petty_cash_topups SET status = 'forwarded_to_finance'
 WHERE status IN ('forwarded_to_area_manager', 'pending', 'forwarded_to_korlap');
UPDATE public.petty_cash_topups SET status = 'approved_by_finance'
 WHERE status IN ('forwarded_by_finance', 'forwarded_by_area_manager', 'forwarded_by_korlap');
ALTER TABLE public.petty_cash_topups ENABLE TRIGGER trg_petty_cash_enforce_flow_update;

-- 2. Mesin status.
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

  RETURN NEW;
END;
$function$;

-- 3. Pengajuan baru langsung ke Finance.
CREATE OR REPLACE FUNCTION public.create_petty_cash_topup(p_outlet_id uuid, p_amount numeric, p_description text, p_bank_name text DEFAULT NULL::text, p_bank_account_number text DEFAULT NULL::text, p_bank_account_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topup_id UUID;
  v_caller_staff_id UUID;
  v_caller_role TEXT;
BEGIN
  v_caller_staff_id := auth.uid();
  IF v_caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff
  WHERE id = v_caller_staff_id AND status = 'active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'regional_manager', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Hanya Leader ke atas yang boleh mengajukan petty cash (role: %)', COALESCE(v_caller_role, 'tidak aktif/tidak dikenal');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengajuan tidak valid';
  END IF;

  IF p_bank_name IS NOT NULL AND p_bank_account_number IS NOT NULL THEN
    UPDATE public.outlets
    SET
      bank_name = p_bank_name,
      bank_account_number = p_bank_account_number,
      bank_account_name = COALESCE(p_bank_account_name, bank_account_name)
    WHERE id = p_outlet_id;
  END IF;

  INSERT INTO public.petty_cash_topups (
    outlet_id, amount, description, status, created_by, created_at,
    bank_name, bank_account_number, bank_account_name
  ) VALUES (
    p_outlet_id, p_amount, p_description, 'forwarded_to_finance',
    v_caller_staff_id, NOW(),
    p_bank_name, p_bank_account_number, p_bank_account_name
  )
  RETURNING id INTO v_topup_id;

  RETURN v_topup_id;
END;
$function$;

-- 4. Pencairan Finance: bukti wajib (transfer maupun tunai).
CREATE OR REPLACE FUNCTION public.finance_process_petty_cash_custom(p_topup_id uuid, p_action text, p_method text DEFAULT 'transfer'::text, p_cash_location_id uuid DEFAULT NULL::uuid, p_proof_of_transfer_url text DEFAULT NULL::text, p_final_amount numeric DEFAULT NULL::numeric, p_description text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topup public.petty_cash_topups%ROWTYPE;
  v_amount numeric;
  v_saldo numeric;
BEGIN
  IF NOT public.kas_pencatat_ok() AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Hanya Finance yang boleh memproses pencairan petty cash';
  END IF;
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan petty cash tidak ditemukan';
  END IF;
  IF v_topup.status IS DISTINCT FROM 'forwarded_to_finance' THEN
    RAISE EXCEPTION 'Pengajuan tidak siap diproses Finance (status: %)', v_topup.status;
  END IF;
  IF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups
    SET status = 'rejected', finance_approved_by = auth.uid(),
        description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;
    RETURN;
  END IF;
  IF p_action IS DISTINCT FROM 'approve' THEN
    RAISE EXCEPTION 'Aksi pencairan tidak valid';
  END IF;
  IF length(btrim(COALESCE(p_proof_of_transfer_url, ''))) = 0 THEN
    RAISE EXCEPTION 'Bukti transfer/serah uang wajib dilampirkan';
  END IF;
  p_method := COALESCE(p_method, 'transfer');
  IF p_method NOT IN ('transfer', 'tunai') THEN
    RAISE EXCEPTION 'Metode pencairan tidak valid';
  END IF;
  PERFORM 1 FROM public.cash_location
  WHERE id = p_cash_location_id AND is_active AND grup = 'petty_cash' AND scope = 'pusat'
    AND kind = CASE p_method WHEN 'transfer' THEN 'bank' ELSE 'cash' END
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pilih sumber Rekening Petty Cash aktif sesuai metode pencairan di dashboard Finance';
  END IF;
  v_amount := COALESCE(p_final_amount, v_topup.amount);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_topup.amount THEN
    RAISE EXCEPTION 'Nominal disetujui harus lebih dari 0 dan tidak melebihi pengajuan';
  END IF;
  SELECT saldo INTO v_saldo FROM public.cash_balance
  WHERE cash_location_id = p_cash_location_id FOR UPDATE;
  IF v_amount > COALESCE(v_saldo, 0) THEN
    RAISE EXCEPTION 'Saldo Rekening Petty Cash tidak mencukupi';
  END IF;
  UPDATE public.petty_cash_topups
  SET status = 'approved_by_finance', finance_approved_by = auth.uid(),
      disbursement_method = p_method, disbursed_from_cash_location_id = p_cash_location_id,
      proof_of_transfer_url = btrim(p_proof_of_transfer_url), amount = v_amount,
      description = COALESCE(p_description, v_topup.description)
  WHERE id = p_topup_id;
  INSERT INTO public.cash_transaction (
    cash_location_id, amount, direction, source_type, source_id, note, occurred_at, created_by, status
  ) VALUES (
    p_cash_location_id, v_amount, 'out', 'petty_cash_topup', p_topup_id,
    'Pencairan Petty Cash Outlet (' || p_method || ')', now(), auth.uid(), 'paid'
  );
END;
$function$;

-- 5. Leader konfirmasi "dana diterima & masuk laci": langsung setelah Finance
--    transfer, hanya untuk outlet yang boleh diakses leader itu.
CREATE OR REPLACE FUNCTION public.leader_forward_funds(p_topup_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_topup RECORD;
  v_status TEXT;
  v_caller_role TEXT;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan petty cash tidak ditemukan';
  END IF;

  -- Kunci transaksi untuk outlet ini agar serial terhadap open_shift / penyesuaian saldo
  PERFORM pg_advisory_xact_lock(hashtextextended(v_topup.outlet_id::TEXT, 0));

  SELECT status INTO v_status FROM public.petty_cash_topups WHERE id = p_topup_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'approved_by_finance' THEN
    RAISE EXCEPTION 'Dana belum ditransfer Finance atau sudah dikonfirmasi (status: %)', v_status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff
  WHERE id = auth.uid() AND status = 'active' AND COALESCE(is_active, true);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Tidak berwenang mengonfirmasi penerimaan dana petty cash';
  END IF;

  IF v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang mengonfirmasi petty cash outlet ini';
  END IF;

  UPDATE public.petty_cash_topups
  SET
    status = 'forwarded_by_leader',
    leader_forwarded_by = auth.uid(),
    leader_forwarded_at = NOW()
  WHERE id = p_topup_id;
END;
$function$;

-- 6. Fungsi tahap AM/korlap lama: pesan jelas untuk app/APK lama yang masih memanggil.
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

-- 7. Push: tidak lagi ke AM. Setelah Finance transfer -> ke pengaju.
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
    v_nominal_fmt := to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999');
    v_title := '💰 Petty Cash Sudah Ditransfer';
    v_body := 'Petty cash ' || v_outlet_nama || ' Rp ' || v_nominal_fmt
           || ' sudah ditransfer Finance. Tekan "Dana diterima" setelah uang masuk laci.';

    FOR v_target_staff IN
      SELECT NEW.created_by AS id WHERE NEW.created_by IS NOT NULL
      UNION
      SELECT os.id FROM public.outlet_staff os
       WHERE NEW.created_by IS NULL
         AND os.outlet_id = NEW.outlet_id
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

-- 8. Riwayat approval: tidak ada lagi keputusan "serah ke AM".
CREATE OR REPLACE FUNCTION public.trg_approval_log_petty_cash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_keputusan text; v_pelaku uuid; v_outlet text;
BEGIN
  BEGIN
    IF OLD.status = 'forwarded_to_finance' AND NEW.status = 'approved_by_finance' THEN
      v_keputusan := 'setuju'; v_pelaku := coalesce(auth.uid(), NEW.finance_approved_by);
    ELSIF OLD.status = 'forwarded_to_finance' AND NEW.status = 'rejected' THEN
      v_keputusan := 'tolak'; v_pelaku := coalesce(auth.uid(), NEW.finance_approved_by);
    ELSE
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM outlets WHERE id = NEW.outlet_id;
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('petty_cash', v_keputusan, NEW.id, v_outlet, left(NEW.description, 200), NEW.amount,
            CASE WHEN v_keputusan = 'tolak' THEN approval_log_ambil_alasan(NEW.description, 'Ditolak Finance:') END,
            v_pelaku, now(), now())
    ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log petty_cash gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $function$;
