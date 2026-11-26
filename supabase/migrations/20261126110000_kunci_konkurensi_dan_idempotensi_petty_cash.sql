-- Hardening konkurensi, urutan lock, dan idempotensi Petty Cash (Pengeluaran POS & Top Up Finance)

-- 1. Serialisasi penutupan shift terhadap pengajuan/void/approval pengeluaran petty cash pada outlet yang sama
CREATE OR REPLACE FUNCTION public.prevent_shift_close_with_pending_petty_cash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'open' AND NEW.status = 'closed' THEN
    -- Ambil kunci advisory per-outlet yang sama dengan add_petty_cash, review_petty_cash_expense,
    -- void_petty_cash_expense, dan leader_forward_funds agar tidak ada transaksi gantung tak terlihat MVCC.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.outlet_id::text, 0));

    IF EXISTS (
      SELECT 1
      FROM public.petty_cash_expenses e
      WHERE e.outlet_id = NEW.outlet_id
        AND e.status = 'pending'
        AND e.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Tidak dapat menutup shift: masih ada pengajuan pengeluaran petty cash yang menunggu approval Finance.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Samakan urutan penguncian void_petty_cash_expense dengan review_petty_cash_expense (advisory outlet -> row FOR UPDATE)
CREATE OR REPLACE FUNCTION public.void_petty_cash_expense(p_expense_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outlet_id UUID;
  v_expense RECORD;
  v_caller_staff_id UUID;
BEGIN
  v_caller_staff_id := auth.uid();
  IF v_caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi';
  END IF;

  SELECT outlet_id INTO v_outlet_id
  FROM public.petty_cash_expenses
  WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengeluaran tidak ditemukan';
  END IF;

  IF v_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang membatalkan pengeluaran ini';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_outlet_id::text, 0));

  SELECT * INTO v_expense
  FROM public.petty_cash_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF v_expense.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pengeluaran ini sudah dibatalkan sebelumnya';
  END IF;

  IF v_expense.status = 'rejected' THEN
    RAISE EXCEPTION 'Pengeluaran yang sudah ditolak Finance tidak dapat dibatalkan';
  END IF;

  UPDATE public.petty_cash_expenses
  SET
    deleted_at    = NOW(),
    delete_reason = btrim(p_reason),
    deleted_by    = v_caller_staff_id
  WHERE id = p_expense_id;
END;
$function$;

-- 3. Idempotensi berdasarkan receipt_url pada add_petty_cash di bawah kunci advisory outlet
CREATE OR REPLACE FUNCTION public.add_petty_cash(
  p_category text,
  p_amount numeric,
  p_description text,
  p_receipt_url text DEFAULT NULL::text,
  p_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS petty_cash_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outlet_id uuid;
  v_row public.petty_cash_expenses;
  v_snap jsonb;
  v_available_balance numeric;
  v_pending_total numeric;
  v_wib_time time;
BEGIN
  v_wib_time := (NOW() AT TIME ZONE 'Asia/Jakarta')::time;
  IF v_wib_time < TIME '06:00:00' OR v_wib_time >= TIME '21:00:00' THEN
    RAISE EXCEPTION 'Pengajuan pengeluaran outlet hanya dapat dilakukan pukul 06:00 hingga 21:00 WIB.';
  END IF;

  IF p_category NOT IN (
    'pengeluaran_outlet','bahan_baku','gas','transport','pln',
    'pdam','internet','lembur','endorsement'
  ) THEN
    RAISE EXCEPTION 'Kategori tidak valid: %', p_category;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran harus lebih dari 0';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Keterangan pengeluaran wajib diisi';
  END IF;

  IF p_receipt_url IS NULL OR btrim(p_receipt_url) = '' THEN
    RAISE EXCEPTION 'Foto bukti struk wajib dilampirkan';
  END IF;

  IF p_outlet_id IS NOT NULL THEN
    IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
      RAISE EXCEPTION 'Anda tidak berhak mencatat pengeluaran di outlet tersebut';
    END IF;
    v_outlet_id := p_outlet_id;
  ELSE
    SELECT outlet_id INTO v_outlet_id
      FROM public.outlet_staff WHERE id = auth.uid();
  END IF;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Akun Anda tidak terhubung ke outlet manapun';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_outlet_id::text, 0));

  -- Idempotensi retry jaringan: bila receipt_url yang persis sama sudah tercatat aktif, kembalikan barisnya
  SELECT * INTO v_row
  FROM public.petty_cash_expenses
  WHERE outlet_id = v_outlet_id
    AND receipt_url = btrim(p_receipt_url)
    AND deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  v_snap := public.get_petty_cash_snapshot(v_outlet_id);
  v_available_balance := COALESCE((v_snap->>'available_balance')::numeric, 0);
  v_pending_total := COALESCE((v_snap->>'pending_expenses_total')::numeric, 0);

  IF v_available_balance < p_amount THEN
    IF v_pending_total > 0 THEN
      RAISE EXCEPTION 'Sisa kuota Petty Cash tidak mencukupi karena ada pengajuan menunggu approval Finance sebesar Rp %. Sisa kuota tersedia: Rp %',
        to_char(v_pending_total, 'FM999,999,999'),
        to_char(v_available_balance, 'FM999,999,999');
    ELSE
      RAISE EXCEPTION 'Saldo Petty Cash tidak mencukupi. Sisa saldo: Rp %',
        to_char(v_available_balance, 'FM999,999,999');
    END IF;
  END IF;

  INSERT INTO public.petty_cash_expenses (
    outlet_id, category, amount, description, expense_date,
    payment_source, created_by, receipt_url, type, status
  )
  VALUES (
    v_outlet_id, p_category, p_amount, btrim(p_description), (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
    'petty_cash', auth.uid(), btrim(p_receipt_url), 'expense', 'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 4. Kunci advisory & proteksi double-submit beruntun pada create_petty_cash_topup
CREATE OR REPLACE FUNCTION public.create_petty_cash_topup(
  p_outlet_id uuid,
  p_amount numeric,
  p_description text,
  p_bank_name text DEFAULT NULL::text,
  p_bank_account_number text DEFAULT NULL::text,
  p_bank_account_name text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_topup_id UUID;
  v_caller_staff_id UUID;
  v_caller_role TEXT;
  v_wib_time TIME;
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

  v_wib_time := (NOW() AT TIME ZONE 'Asia/Jakarta')::time;
  IF v_wib_time < TIME '09:00:00' OR v_wib_time >= TIME '16:00:00' THEN
    RAISE EXCEPTION 'Pengajuan top up petty cash hanya dibuka pukul 09:00 hingga 16:00 WIB.';
  END IF;

  IF p_outlet_id IS NULL OR p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang mengajukan petty cash untuk outlet ini';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengajuan tidak valid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_outlet_id::text, 1));

  -- Cegah duplikasi akibat ketukan ganda / retry jaringan dalam 15 detik dengan payload identik
  SELECT id INTO v_topup_id
  FROM public.petty_cash_topups
  WHERE outlet_id = p_outlet_id
    AND created_by = v_caller_staff_id
    AND status = 'forwarded_to_finance'
    AND amount = p_amount
    AND btrim(COALESCE(description, '')) = btrim(COALESCE(p_description, ''))
    AND created_at >= NOW() - INTERVAL '15 seconds'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_topup_id IS NOT NULL THEN
    RETURN v_topup_id;
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
    p_outlet_id, p_amount, btrim(COALESCE(p_description, '')), 'forwarded_to_finance',
    v_caller_staff_id, NOW(),
    p_bank_name, p_bank_account_number, p_bank_account_name
  )
  RETURNING id INTO v_topup_id;

  RETURN v_topup_id;
END;
$function$;

-- 5. Penjaga jam eksplisit di dalam batal_otomatis_topup_petty_cash_lewat_batas agar kebal jitter cron / pemanggilan dini
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
  v_now_wib TIMESTAMP;
BEGIN
  v_now_wib := NOW() AT TIME ZONE 'Asia/Jakarta';

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
      AND (
        v_now_wib::time >= TIME '16:00:00'
        OR (created_at AT TIME ZONE 'Asia/Jakarta')::date < v_now_wib::date
      )
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

    IF FOUND THEN
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
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;
