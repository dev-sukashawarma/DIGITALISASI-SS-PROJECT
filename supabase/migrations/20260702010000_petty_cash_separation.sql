-- 20260702010000_petty_cash_separation.sql
-- Memisahkan Laci Kasir dengan Kotak Petty Cash secara operasional

-- 1. Modify expenses constraint
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_source_check CHECK (payment_source IN ('cash_drawer', 'transfer_pusat', 'petty_cash'));

-- 2. Create petty_cash_topups table
CREATE TABLE IF NOT EXISTS public.petty_cash_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.petty_cash_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "petty_cash_topups_select" ON public.petty_cash_topups FOR SELECT TO authenticated USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
CREATE POLICY "petty_cash_topups_insert" ON public.petty_cash_topups FOR INSERT TO authenticated WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));
GRANT SELECT, INSERT ON public.petty_cash_topups TO authenticated;

-- 3. Modify shifts table
ALTER TABLE public.shifts 
  ADD COLUMN IF NOT EXISTS actual_ending_petty_cash DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS expected_ending_petty_cash DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS petty_cash_variance DECIMAL(12,2);

-- 4. RPC to get current petty cash balance
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topups DECIMAL;
  v_expenses DECIMAL;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this outlet';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_topups
  FROM public.petty_cash_topups
  WHERE outlet_id = p_outlet_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.expenses
  WHERE outlet_id = p_outlet_id AND payment_source = 'petty_cash';

  RETURN v_topups - v_expenses;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated;

-- 5. RPC to add petty cash (updated to check balance and use payment_source = 'petty_cash')
CREATE OR REPLACE FUNCTION public.add_petty_cash(
  p_category TEXT,
  p_amount DECIMAL,
  p_description TEXT,
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet UUID;
  v_row public.expenses;
  v_current_balance DECIMAL;
BEGIN
  SELECT outlet_id INTO v_outlet FROM public.outlet_staff WHERE id = auth.uid();
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'Akun Anda tidak terhubung ke outlet manapun';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran harus lebih dari 0';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Keterangan pengeluaran wajib diisi';
  END IF;

  IF p_category NOT IN ('bahan_baku', 'operasional', 'utilitas', 'lainnya') THEN
    RAISE EXCEPTION 'Kategori tidak valid';
  END IF;

  -- Validasi saldo petty cash
  v_current_balance := public.get_petty_cash_balance(v_outlet);
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo Petty Cash tidak mencukupi. Sisa saldo: %', v_current_balance;
  END IF;

  INSERT INTO public.expenses (
    outlet_id, category, amount, description, expense_date,
    payment_source, created_by, receipt_url
  )
  VALUES (
    v_outlet, p_category, p_amount, btrim(p_description), CURRENT_DATE,
    'petty_cash', auth.uid(), p_receipt_url
  )
  RETURNING * INTO v_row;
  
  -- Catatan: Trigger trg_link_expense_to_shift hanya memproses payment_source='cash_drawer'.
  -- Petty cash berjalan secara outlet level, bukan per-shift, jadi tidak dilingkarkan ke shift_id secara paksa.
  
  RETURN v_row;
END;
$$;

-- 6. Modify close_shift_blind to accept 2 physical counts
CREATE OR REPLACE FUNCTION public.close_shift_blind(
  p_shift_id UUID, 
  p_actual_cash DECIMAL,
  p_actual_petty_cash DECIMAL DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_cash DECIMAL;
  v_expected_petty_cash DECIMAL;
  v_shift RECORD;
BEGIN
  -- Lock the shift row
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;
  
  IF v_shift.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to close this shift';
  END IF;

  IF v_shift.status = 'closed' THEN
    RAISE EXCEPTION 'Shift already closed';
  END IF;

  -- Pre-set end time for calculation
  UPDATE public.shifts SET end_time = NOW() WHERE id = p_shift_id;
  
  -- Calculate expected balances
  v_expected_cash := public.get_expected_shift_cash(p_shift_id);
  v_expected_petty_cash := public.get_petty_cash_balance(v_shift.outlet_id);
  
  -- Finalize shift
  UPDATE public.shifts
  SET 
    status = 'closed',
    closed_by = auth.uid(),
    expected_ending_cash = v_expected_cash,
    actual_ending_cash = p_actual_cash,
    variance = p_actual_cash - v_expected_cash,
    expected_ending_petty_cash = v_expected_petty_cash,
    actual_ending_petty_cash = p_actual_petty_cash,
    petty_cash_variance = CASE WHEN p_actual_petty_cash IS NOT NULL THEN p_actual_petty_cash - v_expected_petty_cash ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_shift_id;
END;
$$;
