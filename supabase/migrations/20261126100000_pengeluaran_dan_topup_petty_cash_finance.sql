-- ============================================================================
-- Migration: Pengeluaran Outlet POS & Top-Up Petty Cash Langsung ke Finance
-- ============================================================================
-- Keputusan operasional (26 Nov 2026):
-- 1. Pengajuan pengeluaran outlet dari POS (`petty_cash_expenses`):
--    - Jendela input: 06:00–21:00 WIB (diblokir 21:00–05:59 WIB di DB & UI POS).
--    - Persetujuan (`review_petty_cash_expense`) & koreksi kategori
--      (`ubah_kategori_pengeluaran_petty_cash`) pindah dari AM ke Finance
--      (`admin_finance`, `admin`, `owner`, `developer`).
--    - Tutup shift tetap dikunci bila masih ada pengajuan berstatus `pending`.
--    - Push notifikasi tetap dikirim ke AM binaan sebagai INFO pantauan saja,
--      sekaligus dikirim ke `admin_finance` agar segera diproses di Hub Approval.
-- 2. Pengajuan top-up petty cash (`petty_cash_topups`):
--    - Tetap tanpa tahap AM (lanjutan 20261125120000_petty_cash_tanpa_am.sql).
--    - Jendela input: 09:00–16:00 WIB (diblokir di luar jam tersebut).
--    - Tepat pukul 16:00 WIB, semua pengajuan yang masih menunggu di Hub Approval
--      (`forwarded_to_finance`) otomatis dibatalkan sistem (`rejected`) via
--      pg_cron + guard di `finance_process_petty_cash_custom`, dan mengirim push
--      pemberitahuan ke Leader pengaju. Baris yang sudah `approved_by_finance`
--      (sudah ditransfer Finance, menunggu konfirmasi Leader) TIDAK dibatalkan.
-- ============================================================================

SET LOCAL lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- 1. Pengajuan top-up petty cash: batasi input 09:00–16:00 WIB
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Auto-batal top-up petty cash yang masih `forwarded_to_finance` lewat 16:00 WIB
-- ---------------------------------------------------------------------------
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

    -- Kirim push pemberitahuan ke Leader pengaju (tahan galat agar tidak menggagalkan batal).
    IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
      BEGIN
        SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = v_row.outlet_id;
        v_outlet_nama := COALESCE(v_outlet_nama, 'Outlet');
        v_nominal_fmt := replace(to_char(COALESCE(v_row.amount, 0), 'FM999,999,999,999'), ',', '.');

        FOR v_target IN
          SELECT v_row.created_by AS id WHERE v_row.created_by IS NOT NULL
          UNION
          SELECT os.id FROM public.outlet_staff os
          WHERE v_row.created_by IS NULL
            AND os.outlet_id = v_row.outlet_id
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
              'title', '⏰ Top Up Petty Cash Dibatalkan Otomatis',
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

-- Jadwalkan pg_cron setiap hari tepat 16:00 WIB (= 09:00 UTC).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'petty-cash-topup-auto-batal-16wib';

    PERFORM cron.schedule(
      'petty-cash-topup-auto-batal-16wib',
      '0 9 * * *',
      'SELECT public.batal_otomatis_topup_petty_cash_lewat_batas();'
    );
  ELSE
    RAISE NOTICE 'pg_cron belum aktif: job petty-cash-topup-auto-batal-16wib dilewati.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Pendaftaran pg_cron petty-cash-topup-auto-batal-16wib gagal: %', SQLERRM;
END $$;

-- Guard di pencairan Finance: jangan izinkan approve top-up yang sudah melewati cutoff 16:00 WIB
CREATE OR REPLACE FUNCTION public.finance_process_petty_cash_custom(
  p_topup_id uuid,
  p_action text,
  p_method text DEFAULT 'transfer'::text,
  p_cash_location_id uuid DEFAULT NULL::uuid,
  p_proof_of_transfer_url text DEFAULT NULL::text,
  p_final_amount numeric DEFAULT NULL::numeric,
  p_description text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_topup public.petty_cash_topups%ROWTYPE;
  v_amount numeric;
  v_saldo numeric;
  v_now_wib timestamp;
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

  -- Batas proses 16:00 WIB: jika lewat jam 16:00 WIB atau berasal dari hari sebelumnya,
  -- tolak pencairan (sejalan dengan auto-batal 16:00 WIB).
  v_now_wib := NOW() AT TIME ZONE 'Asia/Jakarta';
  IF v_now_wib::time >= TIME '16:00:00'
     OR (v_topup.created_at AT TIME ZONE 'Asia/Jakarta')::date < v_now_wib::date THEN
    RAISE EXCEPTION 'Pengajuan top up petty cash sudah melewati batas waktu proses pukul 16:00 WIB dan dibatalkan oleh sistem.';
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
  SET status = 'approved_by_finance', finance_approved_by = auth.uid(), approved_at = now(),
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

-- ---------------------------------------------------------------------------
-- 3. Pengajuan pengeluaran outlet POS (`add_petty_cash`):
--    batasi jam 06:00–21:00 WIB & arahkan pesan galat ke Finance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_petty_cash(
  p_category text,
  p_amount numeric,
  p_description text,
  p_receipt_url text DEFAULT NULL::text,
  p_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS public.petty_cash_expenses
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

-- ---------------------------------------------------------------------------
-- 4. Persetujuan pengeluaran petty cash POS: pindah dari AM ke Finance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_petty_cash_expense(
  p_expense_id uuid,
  p_action text,
  p_reason text DEFAULT NULL::text
)
RETURNS public.petty_cash_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_caller_status text;
  v_exp public.petty_cash_expenses;
  v_snap jsonb;
  v_current_balance numeric;
  v_updated public.petty_cash_expenses;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  SELECT role, status
  INTO v_caller_role, v_caller_status
  FROM public.outlet_staff
  WHERE id = v_caller_id;

  IF v_caller_status IS DISTINCT FROM 'active'
     OR v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin_finance', 'admin', 'owner', 'developer') THEN
    RAISE EXCEPTION 'Hanya Finance / Owner / Admin yang berwenang memproses approval pengeluaran petty cash';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Aksi tidak valid: %. Gunakan approve atau reject', p_action;
  END IF;

  SELECT * INTO v_exp
  FROM public.petty_cash_expenses
  WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pengajuan pengeluaran tidak ditemukan';
  END IF;

  -- Kunci per outlet lalu kunci baris pengajuan
  PERFORM pg_advisory_xact_lock(hashtextextended(v_exp.outlet_id::text, 0));

  SELECT * INTO v_exp
  FROM public.petty_cash_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pengajuan ini sudah dibatalkan oleh kasir/outlet';
  END IF;

  IF v_exp.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan ini sudah diproses sebelumnya (status: %)', v_exp.status;
  END IF;

  IF p_action = 'approve' THEN
    v_snap := public.get_petty_cash_snapshot(v_exp.outlet_id);
    v_current_balance := COALESCE((v_snap->>'current_balance')::numeric, 0);

    IF v_current_balance < v_exp.amount THEN
      RAISE EXCEPTION 'Saldo Petty Cash outlet saat ini (Rp %) tidak mencukupi untuk menyetujui pengeluaran sebesar Rp %',
        to_char(v_current_balance, 'FM999,999,999'),
        to_char(v_exp.amount, 'FM999,999,999');
    END IF;

    UPDATE public.petty_cash_expenses
    SET
      status = 'approved',
      approved_by = v_caller_id,
      approved_at = NOW(),
      rejection_reason = NULL
    WHERE id = p_expense_id
    RETURNING * INTO v_updated;
  ELSE
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
      RAISE EXCEPTION 'Alasan penolakan wajib diisi';
    END IF;

    UPDATE public.petty_cash_expenses
    SET
      status = 'rejected',
      approved_by = v_caller_id,
      approved_at = NOW(),
      rejection_reason = btrim(p_reason)
    WHERE id = p_expense_id
    RETURNING * INTO v_updated;
  END IF;

  RETURN v_updated;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.review_petty_cash_expense(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Koreksi kategori pengeluaran pending: pindah wewenang dari AM ke Finance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ubah_kategori_pengeluaran_petty_cash(
  p_expense_id uuid,
  p_category text
)
RETURNS public.petty_cash_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_status text;
  v_exp public.petty_cash_expenses;
  v_updated public.petty_cash_expenses;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  SELECT role, status INTO v_caller_role, v_caller_status
  FROM public.outlet_staff WHERE id = v_caller_id;

  IF v_caller_status IS DISTINCT FROM 'active'
     OR v_caller_role IS NULL
     OR v_caller_role NOT IN ('admin_finance', 'admin', 'owner', 'developer') THEN
    RAISE EXCEPTION 'Hanya Finance / Owner / Admin yang boleh mengubah kategori pengeluaran';
  END IF;

  IF p_category IS NULL OR p_category NOT IN (
    'pengeluaran_outlet','bahan_baku','gas','transport','pln',
    'pdam','internet','lembur','endorsement'
  ) THEN
    RAISE EXCEPTION 'Kategori tidak valid: %', p_category;
  END IF;

  SELECT * INTO v_exp FROM public.petty_cash_expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pengajuan pengeluaran tidak ditemukan';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_exp.outlet_id::text, 0));

  SELECT * INTO v_exp FROM public.petty_cash_expenses WHERE id = p_expense_id FOR UPDATE;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pengajuan ini sudah dibatalkan oleh kasir/outlet';
  END IF;
  IF v_exp.status <> 'pending' THEN
    RAISE EXCEPTION 'Kategori hanya bisa diubah selama pengajuan masih menunggu (status: %)', v_exp.status;
  END IF;
  IF v_exp.type IS DISTINCT FROM 'expense' THEN
    RAISE EXCEPTION 'Kategori pengeluaran RAB tidak bisa diubah dari sini';
  END IF;

  IF v_exp.category = p_category THEN
    RETURN v_exp;
  END IF;

  UPDATE public.petty_cash_expenses
  SET category = p_category,
      kategori_asal = COALESCE(kategori_asal, v_exp.category),
      kategori_diubah_oleh = v_caller_id,
      kategori_diubah_pada = NOW()
  WHERE id = p_expense_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.ubah_kategori_pengeluaran_petty_cash(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubah_kategori_pengeluaran_petty_cash(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Void & Penjaga Tutup Shift: sesuaikan pesan galat AM -> Finance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_petty_cash_expense(p_expense_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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

  SELECT * INTO v_expense
  FROM public.petty_cash_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengeluaran tidak ditemukan';
  END IF;

  IF v_expense.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang membatalkan pengeluaran ini';
  END IF;

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

CREATE OR REPLACE FUNCTION public.prevent_shift_close_with_pending_petty_cash()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'open'
     AND NEW.status = 'closed'
     AND EXISTS (
       SELECT 1
       FROM public.petty_cash_expenses e
       WHERE e.outlet_id = NEW.outlet_id
         AND e.status = 'pending'
         AND e.deleted_at IS NULL
     )
  THEN
    RAISE EXCEPTION 'Tidak dapat menutup shift: masih ada pengajuan pengeluaran petty cash yang menunggu approval Finance.';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Push notifikasi saat pengeluaran POS baru (`pending`):
--    - Ke Area Manager binaan: INFO pantauan saja (tidak lagi minta ACC AM).
--    - Ke Admin Finance: pemberitahuan pengajuan menunggu ACC di Hub Approval.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.petty_cash_expense_push_am_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_outlet text;
  v_kategori text;
  v_nominal text;
  v_desc text;
  v_judul_am text;
  v_isi_am text;
  v_judul_fin text;
  v_isi_fin text;
  v_recip record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RAISE WARNING 'Push pengeluaran petty cash dilewati: secret push belum tersedia.';
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_kategori := CASE NEW.category
      WHEN 'pengeluaran_outlet' THEN 'Outlet'
      WHEN 'bahan_baku' THEN 'Bahan baku lainnya'
      WHEN 'gas' THEN 'Gas'
      WHEN 'transport' THEN 'Transport'
      WHEN 'pln' THEN 'Listrik'
      WHEN 'pdam' THEN 'Air'
      WHEN 'internet' THEN 'Internet'
      WHEN 'lembur' THEN 'Overtime'
      WHEN 'endorsement' THEN 'Endorsement'
      WHEN 'rab' THEN 'RAB'
      ELSE initcap(replace(COALESCE(NEW.category, 'pengeluaran'), '_', ' '))
    END;
    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999'), ',', '.');
    v_desc := CASE WHEN COALESCE(btrim(NEW.description), '') <> ''
      THEN ' · ' || left(btrim(NEW.description), 80) ELSE '' END;

    -- 1. Info saja ke AM binaan (tanpa tugas ACC)
    v_judul_am := 'Info Pengeluaran Outlet · ' || COALESCE(v_outlet, 'Outlet');
    v_isi_am := v_kategori || ' Rp ' || v_nominal || v_desc || '. Sedang menunggu ACC Finance.';

    FOR v_recip IN
      SELECT s.id
      FROM public.staff_outlets so
      JOIN public.outlet_staff s ON s.id = so.staff_id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
        AND s.id IS DISTINCT FROM NEW.created_by
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'manager',
          'title', v_judul_am,
          'body', v_isi_am,
          'url', 'manager_petty_cash_pengeluaran'
        )
      );
    END LOOP;

    -- 2. Permintaan ACC ke Admin Finance
    v_judul_fin := 'Pengeluaran Outlet Menunggu ACC · ' || COALESCE(v_outlet, 'Outlet');
    v_isi_fin := v_kategori || ' Rp ' || v_nominal || v_desc || '. Kasir belum bisa tutup shift sebelum diproses.';

    FOR v_recip IN
      SELECT s.id
      FROM public.outlet_staff s
      WHERE s.role = 'admin_finance'
        AND s.status = 'active'
        AND s.id IS DISTINCT FROM NEW.created_by
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'finance',
          'title', v_judul_fin,
          'body', v_isi_fin,
          'url', 'https://finance.sukashawarma.com/approval'
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Push tidak boleh menggagalkan pencatatan pengeluaran kasir.
    RAISE WARNING 'Gagal mengirim push pengeluaran petty cash %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.petty_cash_expense_push_am_pending() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Push notifikasi saat pengajuan top-up petty cash baru (`forwarded_to_finance`):
--    - Ke Area Manager binaan: INFO pantauan saja (tanpa tugas ACC).
--    - Ke Admin Finance: pemberitahuan pengajuan baru di Hub Approval (batas 16:00 WIB).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.petty_cash_topup_push_baru()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_outlet text;
  v_nominal text;
  v_desc text;
  v_recip record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'forwarded_to_finance' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999'), ',', '.');
    v_desc := CASE WHEN COALESCE(btrim(NEW.description), '') <> ''
      THEN ' · ' || left(btrim(NEW.description), 80) ELSE '' END;

    -- 1. Info saja ke AM binaan
    FOR v_recip IN
      SELECT s.id
      FROM public.staff_outlets so
      JOIN public.outlet_staff s ON s.id = so.staff_id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
        AND s.id IS DISTINCT FROM NEW.created_by
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'manager',
          'title', 'Info Pengajuan Top Up · ' || COALESCE(v_outlet, 'Outlet'),
          'body', 'Top up petty cash Rp ' || v_nominal || v_desc || '. Langsung diproses Finance.',
          'url', 'manager_petty_cash'
        )
      );
    END LOOP;

    -- 2. Pemberitahuan ke Admin Finance
    FOR v_recip IN
      SELECT s.id
      FROM public.outlet_staff s
      WHERE s.role = 'admin_finance'
        AND s.status = 'active'
        AND s.id IS DISTINCT FROM NEW.created_by
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'finance',
          'title', 'Top Up Petty Cash Menunggu ACC · ' || COALESCE(v_outlet, 'Outlet'),
          'body', 'Pengajuan Rp ' || v_nominal || v_desc || '. Batas proses pukul 16:00 WIB.',
          'url', 'https://finance.sukashawarma.com/approval'
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push topup baru %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.petty_cash_topup_push_baru() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_petty_cash_topup_push_baru ON public.petty_cash_topups;
CREATE TRIGGER trg_petty_cash_topup_push_baru
  AFTER INSERT ON public.petty_cash_topups
  FOR EACH ROW
  WHEN (NEW.status = 'forwarded_to_finance')
  EXECUTE FUNCTION public.petty_cash_topup_push_baru();
