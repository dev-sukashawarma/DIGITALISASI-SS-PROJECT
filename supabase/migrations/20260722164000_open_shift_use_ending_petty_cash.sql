-- 20260722164000_open_shift_use_ending_petty_cash.sql
-- Buka shift otomatis mengikuti SISA PETTY CASH (ending_petty_cash) shift terakhir yang sudah ditutup (closed).

CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_last_ending DECIMAL;
  v_starting DECIMAL;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this outlet';
  END IF;

  -- Check if there's already an open shift for this outlet
  IF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id AND status = 'open') THEN
    RAISE EXCEPTION 'There is already an open shift for this outlet';
  END IF;

  -- Ambil SISA PETTY CASH (ending_petty_cash) shift terakhir yang sudah ditutup (closed).
  SELECT COALESCE(actual_ending_petty_cash, expected_ending_petty_cash, starting_petty_cash)
  INTO v_last_ending
  FROM public.shifts
  WHERE outlet_id = p_outlet_id
    AND status = 'closed'
  ORDER BY start_time DESC
  LIMIT 1;

  -- Gunakan sisa petty cash shift lalu; jika belum ada shift terdahulu, pakai input p_starting_petty_cash.
  v_starting := COALESCE(v_last_ending, p_starting_petty_cash, 0);

  IF v_starting IS NULL OR v_starting < 0 THEN
    v_starting := 0;
  END IF;

  -- Insert new shift, modal laci (starting_cash) selalu 0, Dana Operasional = v_starting
  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, auth.uid(), 0, v_starting, 'open')
  RETURNING id INTO v_shift_id;

  RETURN v_shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;
