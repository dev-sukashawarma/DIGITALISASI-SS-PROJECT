-- 20260702040000_petty_cash_shift_scoped.sql
-- Mengubah perhitungan petty cash agar scoped per shift berdasarkan input awal kasir

CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topups DECIMAL;
  v_expenses DECIMAL;
  v_starting DECIMAL := 0;
  v_shift_start TIMESTAMPTZ;
  v_shift_id UUID;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this outlet';
  END IF;

  -- Ambil shift yang sedang open
  SELECT id, starting_petty_cash, start_time 
  INTO v_shift_id, v_starting, v_shift_start
  FROM public.shifts 
  WHERE outlet_id = p_outlet_id AND status = 'open' 
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    -- Topup selama shift ini
    SELECT COALESCE(SUM(amount), 0) INTO v_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = p_outlet_id 
      AND status = 'approved'
      AND created_at >= v_shift_start;

    -- Pengeluaran selama shift ini
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses
    FROM public.expenses
    WHERE outlet_id = p_outlet_id 
      AND payment_source = 'petty_cash'
      AND created_at >= v_shift_start;

    RETURN v_starting + v_topups - v_expenses;
  ELSE
    RETURN 0;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_petty_cash_balance(UUID) TO authenticated;

-- Update close_shift_blind agar menghitung petty cash berdasarkan shift-nya (bukan historical)
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
  v_topups DECIMAL;
  v_expenses DECIMAL;
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
  
  -- Calculate expected cash (laci)
  v_expected_cash := public.get_expected_shift_cash(p_shift_id);
  
  -- Calculate expected petty cash (berdasarkan starting_petty_cash shift ini)
  SELECT COALESCE(SUM(amount), 0) INTO v_topups
  FROM public.petty_cash_topups
  WHERE outlet_id = v_shift.outlet_id 
    AND status = 'approved'
    AND created_at >= v_shift.start_time;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.expenses
  WHERE outlet_id = v_shift.outlet_id 
    AND payment_source = 'petty_cash'
    AND created_at >= v_shift.start_time;
    
  v_expected_petty_cash := COALESCE(v_shift.starting_petty_cash, 0) + v_topups - v_expenses;
  
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
GRANT EXECUTE ON FUNCTION public.close_shift_blind(UUID, DECIMAL, DECIMAL) TO authenticated;
