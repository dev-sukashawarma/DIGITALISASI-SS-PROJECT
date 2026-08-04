-- 20260803093000_fix_open_shift_interim_petty_cash.sql
-- Memperbaiki bug di mana saldo interim petty cash yang diterima saat shift ditutup terabaikan

CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_last_ending DECIMAL;
  v_ref_time TIMESTAMPTZ;
  v_interim_topups DECIMAL := 0;
  v_interim_expenses DECIMAL := 0;
  v_starting DECIMAL;
BEGIN
  -- Validasi otorisasi
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this outlet';
  END IF;

  -- Pastikan tidak ada shift yang masih buka
  IF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id AND status = 'open') THEN
    RAISE EXCEPTION 'There is already an open shift for this outlet';
  END IF;

  -- Ambil sisa uang dari shift terakhir beserta waktu tutupnya
  SELECT COALESCE(actual_ending_petty_cash, expected_ending_petty_cash, starting_petty_cash),
         COALESCE(end_time, updated_at)
  INTO v_last_ending, v_ref_time
  FROM public.shifts
  WHERE outlet_id = p_outlet_id
    AND status = 'closed'
  ORDER BY start_time DESC
  LIMIT 1;

  IF v_last_ending IS NOT NULL THEN
    -- Jika ada shift terakhir, kita hitung transaksi yang terjadi SETELAH shift tersebut ditutup (interim)
    
    -- Hitung top-up yang disetujui/diselesaikan saat shift tutup
    SELECT COALESCE(SUM(amount), 0)
    INTO v_interim_topups
    FROM public.petty_cash_topups
    WHERE outlet_id = p_outlet_id
      AND status IN ('completed', 'approved')
      AND completed_at > v_ref_time;

    -- Hitung pengeluaran (meskipun jarang) saat shift tutup
    SELECT COALESCE(SUM(amount), 0)
    INTO v_interim_expenses
    FROM public.petty_cash_expenses
    WHERE outlet_id = p_outlet_id
      AND created_at > v_ref_time;

    -- Saldo baru adalah sisa lama ditambah top-up dikurangi pengeluaran
    v_starting := v_last_ending + v_interim_topups - v_interim_expenses;
  ELSE
    -- Jika outlet baru dan belum pernah buka shift sama sekali, ambil dari parameter layar kasir
    v_starting := p_starting_petty_cash;
  END IF;

  -- Pastikan tidak minus atau null
  IF v_starting IS NULL OR v_starting < 0 THEN
    v_starting := 0;
  END IF;

  -- Buka shift baru
  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, auth.uid(), 0, v_starting, 'open')
  RETURNING id INTO v_shift_id;

  RETURN v_shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;
