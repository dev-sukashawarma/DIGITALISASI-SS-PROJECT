-- ============================================================================
-- Migration: Alur Approval Finance untuk Pengeluaran Petty Cash (POS -> Finance)
-- ============================================================================
-- Aturan Bisnis:
-- 1. Pengeluaran petty cash baru dari POS (Android Native & Web) berstatus
--    awal 'pending' (Menunggu Approval Finance), sedangkan seluruh data
--    historis yang sudah tercatat sebelumnya di-backfill menjadi 'approved'.
-- 2. Saldo utama petty cash (current_balance) BELUM terpotong selama status
--    masih 'pending', namun kuota belanja tersedia (available_balance)
--    dikurangi oleh total pengajuan 'pending' agar kasir tidak over-request.
-- 3. Kasir TIDAK BISA menutup shift selama masih ada pengajuan pengeluaran
--    petty cash berstatus 'pending' (yang belum dibatalkan/diproses Finance).
-- 4. Hanya pengeluaran berstatus 'approved' yang masuk ke perhitungan saldo
--    kas kecil, laporan OPEX, Laba Rugi, dan ROI Mitra.
-- ============================================================================

-- 1. Kolom status & metadata approval pada petty_cash_expenses
ALTER TABLE public.petty_cash_expenses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.petty_cash_expenses
  ALTER COLUMN status SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.petty_cash_expenses'::regclass
      AND conname = 'petty_cash_expenses_status_check'
  ) THEN
    ALTER TABLE public.petty_cash_expenses
      ADD CONSTRAINT petty_cash_expenses_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

ALTER TABLE public.petty_cash_expenses
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Index performa tinggi untuk Hub Approval Finance & perhitungan snapshot/shift
CREATE INDEX IF NOT EXISTS idx_petty_cash_expenses_pending_created
  ON public.petty_cash_expenses (created_at ASC)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_petty_cash_expenses_outlet_status_created
  ON public.petty_cash_expenses (outlet_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Kunci RLS INSERT agar insert langsung dari client selalu masuk antrean 'pending'
ALTER POLICY petty_cash_expenses_insert ON public.petty_cash_expenses
  WITH CHECK (
    (outlet_id IN (SELECT public.accessible_outlet_ids()))
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
  );

-- 2. Canonical Snapshot Petty Cash (hanya memotong saldo untuk status = 'approved',
--    dan menyediakan pending_expenses_total + available_balance untuk kuota belanja)
CREATE OR REPLACE FUNCTION public.get_petty_cash_snapshot(p_outlet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_pending public.petty_cash_adjustments%ROWTYPE;
  v_cutoff TIMESTAMPTZ;
  v_base NUMERIC := 0;
  v_topups NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_pending_expenses NUMERIC := 0;
  v_pending_expenses_count INT := 0;
  v_adjustments NUMERIC := 0;
  v_last_adjustment public.petty_cash_adjustments%ROWTYPE;
  v_carry NUMERIC := 0;
  v_current NUMERIC := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role'
     AND p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat saldo outlet ini';
  END IF;

  -- Hitung total pengajuan pengeluaran yang masih menunggu approval Finance
  SELECT COALESCE(SUM(e.amount), 0), COUNT(*)::INT
  INTO v_pending_expenses, v_pending_expenses_count
  FROM public.petty_cash_expenses e
  WHERE e.outlet_id = p_outlet_id
    AND e.status = 'pending'
    AND e.deleted_at IS NULL;

  SELECT * INTO v_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF FOUND THEN
    -- Ada shift yang sedang aktif (open)
    v_base := COALESCE(v_shift.admin_petty_cash_balance, v_shift.starting_petty_cash, 0);
    v_cutoff := COALESCE(v_shift.admin_petty_cash_updated_at, v_shift.start_time);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND CASE
        WHEN t.status IN ('completed', 'forwarded_by_leader')
          THEN COALESCE(t.leader_forwarded_at, t.completed_at, t.approved_at, t.created_at)
        ELSE COALESCE(t.approved_at, t.created_at)
      END >= v_cutoff;

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.petty_cash_expenses e
    WHERE e.outlet_id = p_outlet_id
      AND COALESCE(e.approved_at, e.created_at) >= v_cutoff
      AND e.status = 'approved'
      AND e.deleted_at IS NULL;

    SELECT COALESCE(SUM(a.adjustment_amount), 0)
    INTO v_adjustments
    FROM public.petty_cash_adjustments a
    WHERE a.shift_id = v_shift.id
      AND a.application_mode = 'active_shift'
      AND a.status = 'applied';

    SELECT * INTO v_last_adjustment
    FROM public.petty_cash_adjustments a
    WHERE a.shift_id = v_shift.id
      AND a.application_mode = 'active_shift'
      AND a.status = 'applied'
    ORDER BY a.applied_at DESC NULLS LAST, a.created_at DESC
    LIMIT 1;

    v_current := v_base + v_topups - v_expenses + v_adjustments;

    RETURN jsonb_build_object(
      'outlet_id', p_outlet_id,
      'shift_id', v_shift.id,
      'shift_status', 'open',
      'has_active_shift', TRUE,
      'starting_balance', COALESCE(v_shift.starting_petty_cash, 0),
      'carry_balance', COALESCE(v_shift.starting_petty_cash, 0),
      'topups_total', v_topups,
      'expenses_total', v_expenses,
      'pending_expenses_total', v_pending_expenses,
      'pending_expenses_count', v_pending_expenses_count,
      'adjustments_total', v_adjustments,
      'current_balance', GREATEST(v_current, 0),
      'available_balance', GREATEST(v_current - v_pending_expenses, 0),
      'opening_balance', NULL,
      'pending_adjustment_id', NULL,
      'pending_note', NULL,
      'last_adjustment_note', v_last_adjustment.note,
      'last_adjustment_at', v_last_adjustment.applied_at,
      'calculated_at', NOW()
    );
  END IF;

  -- Tidak ada shift aktif: hitung saldo carry-forward dari shift terakhir.
  SELECT * INTO v_shift
  FROM public.shifts
  WHERE outlet_id = p_outlet_id AND status = 'closed'
  ORDER BY end_time DESC NULLS LAST, start_time DESC
  LIMIT 1;

  IF FOUND THEN
    v_carry := COALESCE(
      v_shift.actual_ending_petty_cash,
      v_shift.expected_ending_petty_cash,
      v_shift.admin_petty_cash_balance,
      v_shift.starting_petty_cash,
      0
    );
    v_cutoff := COALESCE(v_shift.end_time, v_shift.updated_at, v_shift.start_time);

    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND CASE
        WHEN t.status IN ('completed', 'forwarded_by_leader')
          THEN COALESCE(t.leader_forwarded_at, t.completed_at, t.approved_at, t.created_at)
        ELSE COALESCE(t.approved_at, t.created_at)
      END > v_cutoff;

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.petty_cash_expenses e
    WHERE e.outlet_id = p_outlet_id
      AND COALESCE(e.approved_at, e.created_at) > v_cutoff
      AND e.status = 'approved'
      AND e.deleted_at IS NULL;

    v_carry := v_carry + v_topups - v_expenses;
  ELSE
    -- Jika outlet baru belum pernah memiliki shift tertutup sama sekali
    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_topups
    FROM public.petty_cash_topups t
    WHERE t.outlet_id = p_outlet_id
      AND t.status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader');

    SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.petty_cash_expenses e
    WHERE e.outlet_id = p_outlet_id
      AND e.status = 'approved'
      AND e.deleted_at IS NULL;

    v_carry := v_topups - v_expenses;
  END IF;

  SELECT * INTO v_pending
  FROM public.petty_cash_adjustments
  WHERE outlet_id = p_outlet_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  v_current := v_carry + COALESCE(v_pending.adjustment_amount, 0);

  RETURN jsonb_build_object(
    'outlet_id', p_outlet_id,
    'shift_id', CASE WHEN v_shift.id IS NULL THEN NULL ELSE v_shift.id END,
    'shift_status', CASE WHEN v_shift.id IS NULL THEN NULL ELSE v_shift.status END,
    'has_active_shift', FALSE,
    'starting_balance', CASE WHEN v_shift.id IS NULL THEN 0 ELSE COALESCE(v_shift.starting_petty_cash, 0) END,
    'carry_balance', GREATEST(v_carry, 0),
    'topups_total', v_topups,
    'expenses_total', v_expenses,
    'pending_expenses_total', v_pending_expenses,
    'pending_expenses_count', v_pending_expenses_count,
    'adjustments_total', 0,
    'current_balance', GREATEST(v_current, 0),
    'available_balance', GREATEST(v_current - v_pending_expenses, 0),
    'opening_balance', GREATEST(v_current, 0),
    'pending_adjustment_id', v_pending.id,
    'pending_note', v_pending.note,
    'last_adjustment_note', NULL,
    'last_adjustment_at', NULL,
    'calculated_at', NOW()
  );
END;
$function$;

-- 3. RPC Pengajuan Pengeluaran Petty Cash oleh Kasir/Outlet (status = 'pending')
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
BEGIN
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

  -- Kunci per outlet agar tidak ada pengajuan bersamaan yang menjebol sisa kuota
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
    v_outlet_id, p_category, p_amount, btrim(p_description), CURRENT_DATE,
    'petty_cash', auth.uid(), btrim(p_receipt_url), 'expense', 'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 4. RPC Keputusan Finance: Setujui / Tolak Pengeluaran Petty Cash
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

-- 5. Perbarui void_petty_cash_expense agar menolak pembatalan untuk item yang sudah 'rejected'
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

-- 6. Guard Tutup Shift: Blokir penutupan shift jika masih ada pengeluaran petty cash 'pending'
CREATE OR REPLACE FUNCTION public.prevent_shift_close_with_pending_petty_cash()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Kantor Pusat dikecualikan selaras dengan prevent_shift_close_with_unfinished_orders
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

CREATE OR REPLACE TRIGGER prevent_shift_close_with_pending_petty_cash_trigger
  BEFORE UPDATE OF status ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_shift_close_with_pending_petty_cash();

-- 7. Integrasi Riwayat Approval (approval_log) di Hub Approval Finance
CREATE OR REPLACE FUNCTION public.trg_approval_log_pengeluaran_petty_cash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_keputusan text;
  v_pelaku uuid;
  v_outlet text;
  v_keterangan text;
BEGIN
  BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      v_keputusan := 'setuju';
      v_pelaku := COALESCE(auth.uid(), NEW.approved_by);
    ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
      v_keputusan := 'tolak';
      v_pelaku := COALESCE(auth.uid(), NEW.approved_by);
    ELSE
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_keterangan := left(
      'Pengeluaran ' || upper(replace(COALESCE(NEW.category, ''), '_', ' ')) ||
      CASE WHEN COALESCE(btrim(NEW.description), '') <> '' THEN ' · ' || btrim(NEW.description) ELSE '' END,
      200
    );

    INSERT INTO public.approval_log (
      jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut
    )
    VALUES (
      'petty_cash',
      v_keputusan,
      NEW.id,
      COALESCE(v_outlet, 'Outlet'),
      v_keterangan,
      NEW.amount,
      CASE WHEN v_keputusan = 'tolak' THEN NEW.rejection_reason ELSE NULL END,
      v_pelaku,
      COALESCE(NEW.approved_at, NOW()),
      COALESCE(NEW.approved_at, NOW())
    )
    ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log pengeluaran_petty_cash gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_approval_log_pengeluaran_petty_cash
  AFTER UPDATE OF status ON public.petty_cash_expenses
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_approval_log_pengeluaran_petty_cash();

-- 8. Perbarui trigger peringatan Bot CEO agar hanya mengevaluasi pengeluaran yang sudah 'approved'
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_petty_cash_deficit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric := 0;
  v_topups numeric := 0;
  v_expenses numeric := 0;
  v_starting numeric := 0;
  v_shift_start timestamptz;
  v_shift_id uuid;
  v_outlet_nama text;
  v_ceo record;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;

  SELECT id, coalesce(starting_petty_cash, 0), start_time
  INTO v_shift_id, v_starting, v_shift_start
  FROM public.shifts
  WHERE outlet_id = NEW.outlet_id AND status = 'open'
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    SELECT coalesce(sum(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = NEW.outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND (created_at >= v_shift_start OR completed_at >= v_shift_start OR leader_forwarded_at >= v_shift_start);

    SELECT coalesce(sum(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = NEW.outlet_id
      AND COALESCE(approved_at, created_at) >= v_shift_start
      AND status = 'approved'
      AND deleted_at IS NULL;

    v_balance := v_starting + v_topups - v_expenses;
  ELSE
    SELECT coalesce(sum(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = NEW.outlet_id
      AND status IN ('completed', 'approved', 'approved_by_finance', 'forwarded_by_leader')
      AND created_at >= (now() - interval '30 days');

    SELECT coalesce(sum(amount), 0) INTO v_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = NEW.outlet_id
      AND COALESCE(approved_at, created_at) >= (now() - interval '30 days')
      AND status = 'approved'
      AND deleted_at IS NULL;

    v_balance := v_topups - v_expenses;
  END IF;

  IF v_balance < 0 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('petty_cash_deficit:%s:%s', NEW.outlet_id::text, v_today::text),
        v_ceo.id,
        '🚨 [FINANCE WARNING] Saldo Kas Kecil Jebol / Minus — ' || coalesce(v_outlet_nama, 'Outlet'),
        format(
          E'Laci kas kecil gerai mengalami defisit dana (saldo negatif).\nOutlet: %s\nPengeluaran Terakhir: Rp %s (%s)\nEstimasi Saldo Kas Kecil: -Rp %s\n\nPerhatian Direksi: Kasir/Leader membelanjakan uang di luar anggaran yang tersedia. Berisiko tinggi menutupi kekurangan menggunakan uang omzet tunai kasir!',
          coalesce(v_outlet_nama, 'Outlet'),
          to_char(NEW.amount, 'FM999,999,999'),
          coalesce(NEW.description, NEW.category, 'Pengeluaran'),
          to_char(abs(v_balance), 'FM999,999,999')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_bot_ceo_petty_cash_deficit
  AFTER INSERT OR UPDATE OF status ON public.petty_cash_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_finance_petty_cash_deficit();

CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_finance_no_receipt_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outlet_nama text;
  v_staff_nama text;
  v_ceo record;
  v_is_violation boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  IF NEW.receipt_url IS NULL OR trim(NEW.receipt_url) = '' THEN
    IF NEW.amount >= 100000 THEN
      v_is_violation := true;
    ELSIF NEW.amount >= 50000 AND NEW.category IN ('lainnya', 'pengeluaran_outlet', 'outlet') THEN
      v_is_violation := true;
    END IF;
  END IF;

  IF v_is_violation THEN
    SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = NEW.outlet_id;
    SELECT name INTO v_staff_nama FROM public.outlet_staff WHERE id = NEW.created_by;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('no_receipt_expense:%s', NEW.id::text),
        v_ceo.id,
        '⚠️ [FINANCE WARNING] Pengeluaran Kas Kecil Tanpa Bukti Nota Fisik — ' || coalesce(v_outlet_nama, 'Outlet'),
        format(
          E'Tercatat pengeluaran kas operasional gerai tanpa lampiran bukti foto struk/nota fisik yang sah.\nOutlet: %s\nNominal: Rp %s\nKategori: %s\nKeterangan: %s\nPencatat: %s\n\nPerhatian Direksi: Potensi nota fiktif atau pengeluaran tidak dapat dipertanggungjawabkan saat audit. Finance wajib verifikasi fisik nota ke Leader cabang.',
          coalesce(v_outlet_nama, 'Outlet'),
          to_char(NEW.amount, 'FM999,999,999'),
          upper(replace(NEW.category, '_', ' ')),
          coalesce(NEW.description, '-'),
          coalesce(v_staff_nama, 'Kru Kasir')
        ),
        'https://finance.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_finance_no_receipt_expense gagal: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER trg_bot_ceo_finance_no_receipt_expense
  AFTER INSERT OR UPDATE OF status ON public.petty_cash_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_bot_ceo_finance_no_receipt_expense();

-- 9. Filter status = 'approved' pada RPC pelaporan OPEX (get_mitra_roi & get_owner_dashboard_summary)
CREATE OR REPLACE FUNCTION public.get_mitra_roi(
  p_outlet_ids uuid[],
  p_from timestamp with time zone DEFAULT '2026-08-01 00:00:00+07'::timestamp with time zone,
  p_to timestamp with time zone DEFAULT now()
)
RETURNS TABLE(
  outlet_id uuid,
  modal_investasi numeric,
  omzet_historis numeric,
  transfer_historis numeric,
  sudah_diterima numeric,
  omzet numeric,
  deduksi numeric,
  cogs numeric,
  opex numeric,
  waste numeric,
  management_fee numeric,
  laba_bersih numeric,
  persentase numeric,
  bagi_hasil_mitra numeric,
  dana_kembali numeric,
  roi_pct numeric,
  bep_pct numeric,
  is_bep boolean,
  is_bep_kebijakan boolean,
  sisa_modal numeric,
  roi_diterima_pct numeric
)
LANGUAGE sql
SET search_path TO 'public'
AS $function$
with
konstanta as (
  select date '2026-09-01' as cutoff_kebijakan
),
kebijakan as (
  select ((p_to at time zone 'Asia/Jakarta')::date >= k.cutoff_kebijakan) as pakai_aturan_baru
  from konstanta k
),
ord as (
  select s.outlet_id,
         coalesce(sum(s.gross_revenue), 0) as omzet,
         coalesce(sum(s.deductions), 0)    as deduksi,
         coalesce(sum(s.cogs), 0)          as cogs
  from get_mitra_orders_summary(p_outlet_ids, p_from, p_to) s
  group by s.outlet_id
),
petty as (
  select e.outlet_id, coalesce(sum(e.amount), 0) as total
  from petty_cash_expenses e
  where e.outlet_id = any(p_outlet_ids)
    and e.status = 'approved'
    and e.deleted_at is null
    and e.expense_date >= (p_from at time zone 'Asia/Jakarta')::date
  group by e.outlet_id
),
bulanan as (
  select e.outlet_id, coalesce(sum(e.amount), 0) as total
  from expenses e
  where e.outlet_id = any(p_outlet_ids)
    and e.type = 'expense'
    and e.expense_date >= (p_from at time zone 'Asia/Jakarta')::date
  group by e.outlet_id
),
waste_per_outlet as (
  select w.outlet_id, coalesce(sum(w.nilai_waste), 0) as total
  from get_waste_periode(
    (p_from at time zone 'Asia/Jakarta')::date,
    (p_to at time zone 'Asia/Jakarta')::date
  ) w
  where w.outlet_id = any(p_outlet_ids)
  group by w.outlet_id
),
transfer as (
  select t.outlet_id, coalesce(sum(t.nominal), 0) as total
  from mitra_transfers t
  where t.outlet_id = any(p_outlet_ids)
  group by t.outlet_id
),
dasar as (
  select
    o.id as outlet_id,
    coalesce(inv.nilai_investasi, 0)     as modal_investasi,
    coalesce(inv.omzet_historis, 0)      as omzet_historis,
    coalesce(inv.transfer_historis, 0)   as transfer_historis,
    coalesce(tr.total, 0)                as sudah_diterima,
    coalesce(inv.persentase_bagi_hasil, mp.profit_sharing_pct, 50) as pct_historis,
    coalesce(inv.management_fee, 0)      as fee_historis,
    coalesce(ord.omzet, 0)               as omzet,
    coalesce(ord.deduksi, 0)             as deduksi,
    coalesce(ord.cogs, 0)                as cogs,
    coalesce(p.total, 0) + coalesce(b.total, 0) as opex,
    coalesce(w.total, 0)                 as waste
  from unnest(p_outlet_ids) as o(id)
  left join mitra_investments inv on inv.outlet_id = o.id
  left join lateral (
    select mp.profit_sharing_pct
    from mitra_profiles mp
    where o.id = any(mp.outlet_ids)
    order by mp.id
    limit 1
  ) mp on true
  left join ord on ord.outlet_id = o.id
  left join petty p on p.outlet_id = o.id
  left join bulanan b on b.outlet_id = o.id
  left join waste_per_outlet w on w.outlet_id = o.id
  left join transfer tr on tr.outlet_id = o.id
),
tarif as (
  select
    d.*,
    (d.modal_investasi > 0
      and (d.omzet_historis + d.transfer_historis + d.sudah_diterima) >= d.modal_investasi
    ) as is_bep_kebijakan
  from dasar d
),
hitung as (
  select
    t.*,
    case when k.pakai_aturan_baru
         then case when t.is_bep_kebijakan then 50 else 100 end
         else t.pct_historis end as pct,
    case when k.pakai_aturan_baru
         then case when t.is_bep_kebijakan then 0 else 3 end
         else t.fee_historis end as fee_pct
  from tarif t cross join kebijakan k
),
hasil as (
  select
    h.*,
    round(h.omzet * h.fee_pct / 100) as mgmt_fee,
    (h.omzet - h.deduksi - h.cogs - h.opex - h.waste - round(h.omzet * h.fee_pct / 100)) as laba
  from hitung h
),
akhir as (
  select
    h.*,
    case when h.laba > 0 then round(h.laba * h.pct / 100) else 0 end as bagi_hasil
  from hasil h
)
select
  a.outlet_id,
  a.modal_investasi,
  a.omzet_historis,
  a.transfer_historis,
  a.sudah_diterima,
  a.omzet,
  a.deduksi,
  a.cogs,
  a.opex,
  a.waste,
  a.mgmt_fee                                        as management_fee,
  a.laba                                            as laba_bersih,
  a.pct                                             as persentase,
  a.bagi_hasil                                      as bagi_hasil_mitra,
  (a.omzet_historis + a.transfer_historis + a.bagi_hasil) as dana_kembali,
  case when a.modal_investasi > 0
       then ((a.omzet_historis + a.transfer_historis + a.bagi_hasil) / a.modal_investasi) * 100
       else 0 end                                   as roi_pct,
  least(
    round((case when a.modal_investasi > 0
                then ((a.omzet_historis + a.transfer_historis + a.bagi_hasil) / a.modal_investasi) * 100
                else 0 end)::numeric, 1),
    100
  )                                                 as bep_pct,
  (a.modal_investasi > 0
    and (a.omzet_historis + a.transfer_historis + a.bagi_hasil) >= a.modal_investasi) as is_bep,
  a.is_bep_kebijakan,
  greatest(0, a.modal_investasi - (a.omzet_historis + a.transfer_historis + a.bagi_hasil)) as sisa_modal,
  case when a.modal_investasi > 0
       then ((a.omzet_historis + a.transfer_historis + a.sudah_diterima) / a.modal_investasi) * 100
       else 0 end                                   as roi_diterima_pct
from akhir a;
$function$;

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_summary(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_outlet_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'all'::text,
  p_test_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET plan_cache_mode TO 'force_custom_plan'
AS $function$
DECLARE
  v_result jsonb;
  v_user_role text;
  v_has_full_access boolean := false;
  v_test_outlet_ids uuid[];
  v_mitra_outlet_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    v_has_full_access := true;
  ELSIF coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'OWNER'
     OR coalesce(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role', '') = 'OWNER' THEN
    v_has_full_access := true;
  ELSE
    SELECT os.role INTO v_user_role
    FROM public.outlet_staff os
    WHERE os.id = auth.uid();

    IF v_user_role IN (
      'admin', 'admin_hr', 'owner', 'spv', 'kitchen',
      'admin_finance', 'regional_manager', 'developer', 'purchasing'
    ) THEN
      v_has_full_access := true;
    END IF;
  END IF;

  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[]) INTO v_test_outlet_ids
  FROM public.outlets o
  WHERE o.id = COALESCE(p_test_outlet_id, 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid)
     OR COALESCE(o.name, '') ~* '(tes|test|trial|demo)'
     OR COALESCE(o.slug, '') ~* '(tes|test|trial|demo)';

  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[]) INTO v_mitra_outlet_ids
  FROM public.outlets o
  WHERE (
      o.type = 'mitra'
      OR EXISTS (SELECT 1 FROM public.mitra_investments mi WHERE mi.outlet_id = o.id)
      OR COALESCE(o.name, '') ILIKE '%mitra%'
    )
    AND NOT (o.id = ANY(v_test_outlet_ids));

  WITH ord AS (
    SELECT
      o.id,
      o.outlet_id,
      o.total_amount,
      o.discount_amount,
      o.promo_subsidy,
      lower(COALESCE(NULLIF(btrim(o.channel), ''), NULLIF(btrim(o.sales_source), ''), 'pos')) AS raw_channel,
      CASE
        WHEN o.is_endorse THEN 'endors'
        WHEN lower(COALESCE(o.channel, '')) IN ('endorse', 'endors')
          OR lower(COALESCE(o.sales_source, '')) IN ('endorse', 'endors') THEN 'endors'
        WHEN lower(COALESCE(o.channel, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')
          OR (COALESCE(o.channel, '') = '' AND lower(COALESCE(o.sales_source, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')) THEN 'app'
        WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
        WHEN lower(o.channel) = 'shopeefood' THEN 'shopeefood'
        WHEN lower(o.channel) = 'tiktokgo' THEN 'tiktok'
        WHEN lower(o.channel) = 'grabfood' THEN 'grabfood'
        WHEN lower(o.channel) = 'gofood' THEN 'gofood'
        WHEN lower(o.channel) IN ('website', 'online', 'web') THEN 'online'
        ELSE public.resolve_sales_source(o.channel, o.sales_source)
      END AS src_key,
      (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS local_hour,
      (o.outlet_id = ANY(v_mitra_outlet_ids)) AS is_mitra
    FROM public.orders o
    WHERE o.status = 'completed'
      AND o.created_at >= p_from
      AND o.created_at <= p_to
      AND (v_has_full_access OR o.outlet_id IN (SELECT public.accessible_outlet_ids()))
      AND NOT (o.outlet_id = ANY(v_test_outlet_ids))
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
      AND (
        p_source = 'all'
        OR CASE
             WHEN o.is_endorse THEN 'endors'
             WHEN lower(COALESCE(o.channel, '')) IN ('endorse', 'endors')
               OR lower(COALESCE(o.sales_source, '')) IN ('endorse', 'endors') THEN 'endors'
             WHEN lower(COALESCE(o.channel, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')
               OR (COALESCE(o.channel, '') = '' AND lower(COALESCE(o.sales_source, '')) IN ('app', 'aplikasi', 'suka_app', 'sukashawarma_app')) THEN 'app'
             WHEN o.channel IS NULL OR o.channel = '' THEN lower(COALESCE(o.sales_source, 'pos'))
             WHEN lower(o.channel) = 'shopeefood' THEN 'shopeefood'
             WHEN lower(o.channel) = 'tiktokgo' THEN 'tiktok'
             WHEN lower(o.channel) = 'grabfood' THEN 'grabfood'
             WHEN lower(o.channel) = 'gofood' THEN 'gofood'
             WHEN lower(o.channel) IN ('website', 'online', 'web') THEN 'online'
             ELSE public.resolve_sales_source(o.channel, o.sales_source)
           END = p_source
      )
  ),
  items_raw AS MATERIALIZED (
    SELECT
      oi.order_id,
      oi.menu_item_id,
      oi.quantity,
      oi.subtotal,
      oi.menu_item_name,
      oi.is_promo_reward,
      ord.outlet_id,
      ord.is_mitra,
      ord.raw_channel,
      ord.local_date
    FROM ord
    JOIN public.order_items oi ON oi.order_id = ord.id
  ),
  menu_tgl AS (
    SELECT DISTINCT ir.menu_item_id, ir.raw_channel, ir.local_date
    FROM items_raw ir
    WHERE ir.menu_item_id IS NOT NULL
  ),
  menu_hpp AS MATERIALIZED (
    SELECT
      mt.menu_item_id AS id,
      mt.raw_channel,
      mt.local_date,
      COALESCE(public.get_mitra_item_hpp_base(mt.menu_item_id, mt.raw_channel, mt.local_date), 0) AS unit_hpp,
      CASE
        WHEN mt.local_date >= DATE '2026-10-01'
          THEN COALESCE(public.get_mitra_item_hpp(mt.menu_item_id, mt.raw_channel, mt.local_date, NULL), 0)
        ELSE 0
      END AS unit_mitra_std,
      CASE
        WHEN mt.local_date >= DATE '2026-10-01'
          THEN COALESCE(public.get_mitra_item_hpp_murni(mt.menu_item_id, mt.raw_channel, mt.local_date), 0)
        ELSE 0
      END AS unit_murni
    FROM menu_tgl mt
  ),
  items_base AS (
    SELECT
      ir.order_id,
      ir.quantity,
      ir.subtotal,
      trim(split_part(ir.menu_item_name, '|', 1)) AS menu_name,
      ir.outlet_id,
      ir.is_mitra,
      ir.local_date,
      COALESCE(ir.is_promo_reward, false) AS is_promo_reward,
      COALESCE(
        NULLIF(mh.unit_hpp, 0),
        public.get_mitra_item_hpp_base_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date),
        0
      ) AS base_hpp,
      CASE
        WHEN ir.is_mitra
         AND ir.local_date >= DATE '2026-10-01'
         AND ir.outlet_id <> '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
        THEN COALESCE(
          NULLIF(mh.unit_mitra_std, 0),
          public.get_mitra_item_hpp_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date, ir.outlet_id),
          0
        )
        ELSE 0
      END AS mitra_std_hpp,
      CASE
        WHEN ir.is_mitra
         AND ir.local_date >= DATE '2026-10-01'
         AND ir.outlet_id <> '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
        THEN COALESCE(
          NULLIF(mh.unit_murni, 0),
          public.get_mitra_item_hpp_murni_by_name(ir.menu_item_name, ir.raw_channel, ir.local_date),
          0
        )
        ELSE 0
      END AS mitra_murni_hpp
    FROM items_raw ir
    LEFT JOIN menu_hpp mh
      ON mh.id = ir.menu_item_id
     AND mh.raw_channel = ir.raw_channel
     AND mh.local_date = ir.local_date
  ),
  items AS (
    SELECT
      ib.order_id,
      ib.quantity,
      ib.subtotal,
      ib.menu_name,
      (CASE
        WHEN NOT ib.is_mitra THEN ib.base_hpp
        WHEN ib.local_date >= DATE '2026-11-01' THEN ROUND(ib.base_hpp * 1.15) WHEN ib.local_date < DATE '2026-10-01'
          OR ib.outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
          THEN ROUND(ib.base_hpp * 1.1)
        ELSE ib.mitra_std_hpp
      END) * COALESCE(ib.quantity, 1) AS item_cogs,
      (CASE
        WHEN NOT ib.is_mitra THEN 0
        WHEN ib.local_date >= DATE '2026-11-01' THEN (ROUND(ib.base_hpp * 1.15) - ib.base_hpp) WHEN ib.local_date < DATE '2026-10-01'
          OR ib.outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
          THEN (ROUND(ib.base_hpp * 1.1) - ib.base_hpp)
        ELSE (ib.mitra_std_hpp - ib.mitra_murni_hpp)
      END) * COALESCE(ib.quantity, 1) AS item_markup,
      ib.is_promo_reward
    FROM items_base ib
  ),
  order_totals AS (
    SELECT
      it.order_id,
      SUM(it.subtotal) AS total_subtotal,
      SUM(it.quantity) AS total_quantity
    FROM items it
    GROUP BY it.order_id
  ),
  order_calc AS (
    SELECT
      o.outlet_id,
      o.src_key,
      o.local_date,
      o.local_hour,
      COALESCE(ot.total_quantity, 0) AS total_quantity,
      CASE
        WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
          GREATEST(0::numeric, COALESCE(o.total_amount, 0::numeric) - (
            GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
          ))
        ELSE
          COALESCE(o.total_amount, 0::numeric)
      END AS net_omzet,
      CASE
        WHEN o.src_key IN ('shopeefood', 'grabfood', 'gofood', 'tiktok') THEN
          GREATEST(0::numeric, COALESCE(ot.total_subtotal, 0::numeric) - COALESCE(o.total_amount, 0::numeric)) + COALESCE(o.promo_subsidy, 0)::numeric
        WHEN ot.total_subtotal IS NULL THEN
          COALESCE(o.discount_amount, 0::numeric) + COALESCE(o.promo_subsidy, 0::numeric)
        ELSE
          GREATEST(0::numeric, ot.total_subtotal - COALESCE(o.total_amount, 0::numeric))
      END AS deduction
    FROM ord o
    LEFT JOIN order_totals ot ON ot.order_id = o.id
  ),
  kpi_agg AS (
    SELECT
      oc.outlet_id,
      oc.src_key AS sales_source,
      oc.local_date AS sales_date,
      COALESCE(SUM(oc.net_omzet), 0::numeric) AS omzet,
      COUNT(*) AS order_count,
      COALESCE(SUM(oc.total_quantity), 0) AS total_qty,
      COALESCE(SUM(oc.deduction), 0::numeric) AS total_deductions
    FROM order_calc oc
    GROUP BY oc.outlet_id, oc.src_key, oc.local_date
  ),
  hourly_agg AS (
    SELECT
      oc.local_hour AS sales_hour,
      COALESCE(SUM(oc.net_omzet + oc.deduction), 0::numeric) AS omzet,
      COUNT(*) AS order_count
    FROM order_calc oc
    GROUP BY oc.local_hour
  ),
  menu_agg AS (
    SELECT
      it.menu_name,
      SUM(it.quantity) AS qty,
      SUM(it.subtotal) AS revenue
    FROM items it
    WHERE it.menu_name IS NOT NULL
      AND it.menu_name <> ''
    GROUP BY it.menu_name
    ORDER BY revenue DESC
  ),
  totals_agg AS (
    SELECT
      COALESCE(SUM(it.item_cogs), 0) AS total_cogs,
      COALESCE(SUM(it.item_markup), 0) AS total_mitra_markup,
      COUNT(DISTINCT CASE WHEN it.is_promo_reward THEN it.order_id END) AS bogo_transactions,
      COALESCE(SUM(CASE WHEN it.is_promo_reward THEN it.quantity ELSE 0 END), 0) AS bogo_gift_units
    FROM items it
  ),
  opex_agg AS (
    SELECT
      COALESCE((
        SELECT SUM(e.amount)
        FROM public.expenses e
        WHERE e.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND e.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND e.type = 'expense'
          AND (v_has_full_access OR e.outlet_id IN (SELECT public.accessible_outlet_ids()))
          AND (e.outlet_id IS NULL OR NOT (e.outlet_id = ANY(v_test_outlet_ids)))
          AND (p_outlet_id IS NULL OR e.outlet_id = p_outlet_id)
          AND NOT (e.category IN ('joint_expense', 'joint_expanse') AND e.expense_date >= '2026-10-01')
          AND NOT (e.description ILIKE '[MARCOM: HPP Menu KOL%' AND e.expense_date >= '2026-10-01')
      ), 0) +
      COALESCE((
        SELECT SUM(pce.amount)
        FROM public.petty_cash_expenses pce
        WHERE pce.expense_date >= (p_from AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.expense_date <= (p_to   AT TIME ZONE 'Asia/Jakarta')::date
          AND pce.status = 'approved'
          AND pce.deleted_at IS NULL
          AND (v_has_full_access OR pce.outlet_id IN (SELECT public.accessible_outlet_ids()))
          AND NOT (pce.outlet_id = ANY(v_test_outlet_ids))
          AND (p_outlet_id IS NULL OR pce.outlet_id = p_outlet_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.expenses r
            WHERE r.outlet_id = pce.outlet_id
              AND r.type = 'expense'
              AND date_trunc('month', r.expense_date) = date_trunc('month', pce.expense_date)
              AND r.description ~* '^\s*OPEX\s+\S+\s+\d{4}\s+-\s'
          )
      ), 0) AS total_opex
  )
  SELECT jsonb_build_object(
    'kpi_rows',           COALESCE((SELECT jsonb_agg(row_to_json(k)) FROM kpi_agg k), '[]'::jsonb),
    'hourly_rows',        COALESCE((SELECT jsonb_agg(row_to_json(h) ORDER BY h.sales_hour) FROM hourly_agg h), '[]'::jsonb),
    'menu_rows',          COALESCE((SELECT jsonb_agg(row_to_json(m) ORDER BY m.revenue DESC) FROM menu_agg m), '[]'::jsonb),
    'total_cogs',         (SELECT total_cogs FROM totals_agg),
    'total_mitra_markup', (SELECT total_mitra_markup FROM totals_agg),
    'total_opex',         (SELECT total_opex FROM opex_agg),
    'bogo_transactions',  (SELECT bogo_transactions FROM totals_agg),
    'bogo_gift_units',    (SELECT bogo_gift_units FROM totals_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
