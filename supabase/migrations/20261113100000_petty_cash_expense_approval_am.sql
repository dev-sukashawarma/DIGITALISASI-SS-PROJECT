-- ============================================================================
-- Migration: Persetujuan Pengeluaran Petty Cash POS pindah dari Finance ke AM
-- ============================================================================
-- Aturan bisnis baru (13 Nov 2026):
-- 1. Pengajuan pengeluaran petty cash dari POS (status 'pending') kini disetujui /
--    ditolak oleh Area Manager yang MEMBINA outlet tersebut (tabel staff_outlets,
--    sumber yang sama dengan accessible_outlet_ids() dan RLS SELECT tabel ini).
-- 2. Finance / admin / owner TIDAK lagi berwenang memprosesnya.
-- 3. 'developer' dipertahankan sebagai jalur darurat & uji (outlet tanpa AM,
--    mis. outlet tes) — setara RM di modul Manager (migrasi 20300253000000).
-- 4. Pesan galat di add_petty_cash, void_petty_cash_expense, dan penjaga tutup
--    shift disesuaikan: "menunggu approval AM".
-- Seluruh logika saldo, kunci advisory, approval_log, dan trigger Bot CEO tidak
-- berubah (lihat 20261111161500_petty_cash_expense_finance_approval.sql).
-- ============================================================================

-- Cek binaan memakai PK staff_outlets (staff_id, outlet_id) — tidak perlu index baru.

-- 1. RPC keputusan: Setujui / Tolak — kini AM binaan
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
     OR v_caller_role NOT IN ('area_manager', 'developer') THEN
    RAISE EXCEPTION 'Hanya Area Manager outlet binaan yang berwenang memproses approval pengeluaran petty cash';
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

  IF v_caller_role = 'area_manager' AND NOT EXISTS (
    SELECT 1 FROM public.staff_outlets so
    WHERE so.staff_id = v_caller_id
      AND so.outlet_id = v_exp.outlet_id
  ) THEN
    RAISE EXCEPTION 'Outlet ini bukan outlet binaan Anda';
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

-- 2. add_petty_cash: hanya pesan galat kuota yang berubah (Finance -> AM)
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

  PERFORM pg_advisory_xact_lock(hashtextextended(v_outlet_id::text, 0));

  v_snap := public.get_petty_cash_snapshot(v_outlet_id);
  v_available_balance := COALESCE((v_snap->>'available_balance')::numeric, 0);
  v_pending_total := COALESCE((v_snap->>'pending_expenses_total')::numeric, 0);

  IF v_available_balance < p_amount THEN
    IF v_pending_total > 0 THEN
      RAISE EXCEPTION 'Sisa kuota Petty Cash tidak mencukupi karena ada pengajuan menunggu approval AM sebesar Rp %. Sisa kuota tersedia: Rp %',
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

-- 3. void_petty_cash_expense: pesan galat netral (bukan "Finance")
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
    RAISE EXCEPTION 'Pengeluaran yang sudah ditolak AM tidak dapat dibatalkan';
  END IF;

  UPDATE public.petty_cash_expenses
  SET
    deleted_at    = NOW(),
    delete_reason = btrim(p_reason),
    deleted_by    = v_caller_staff_id
  WHERE id = p_expense_id;
END;
$function$;

-- 4. Penjaga tutup shift: pesan galat Finance -> AM
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
    RAISE EXCEPTION 'Tidak dapat menutup shift: masih ada pengajuan pengeluaran petty cash yang menunggu approval AM.';
  END IF;

  RETURN NEW;
END;
$function$;
