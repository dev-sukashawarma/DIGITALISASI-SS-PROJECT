-- 20260704100000_open_shift_reset_to_last_opening.sql
-- Root-cause guarantee: buka shift SELALU reset Dana Operasional ke SETORAN AWAL
-- (starting_petty_cash) shift terakhir, BUKAN sisa/hitungan akhir laci.
--
-- Sebelumnya penegakan hanya di frontend (field terkunci ke setoran awal terakhir).
-- Kalau ada frontend versi lama / jalur lain yang mengirim nominal sisa, nilai itu
-- bisa lolos. Migrasi ini memindahkan invariant ke server (defense in depth):
--   * Bila outlet SUDAH punya shift dengan setoran awal valid (> 0) -> pakai nilai itu,
--     abaikan input klien. Jadi mustahil "mengikuti sisa" shift sebelumnya.
--   * Bila belum pernah ada (shift pertama outlet) -> pakai input klien sebagai seeding.

CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
  v_prev_starting DECIMAL;
  v_starting DECIMAL;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this outlet';
  END IF;

  -- Check if there's already an open shift for this outlet
  IF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id AND status = 'open') THEN
    RAISE EXCEPTION 'There is already an open shift for this outlet';
  END IF;

  -- Ambil SETORAN AWAL (starting_petty_cash) shift terakhir yang valid (> 0).
  -- Baris anomali (0/null) dilewati agar tidak mengunci outlet ke nominal keliru.
  SELECT starting_petty_cash
  INTO v_prev_starting
  FROM public.shifts
  WHERE outlet_id = p_outlet_id
    AND starting_petty_cash IS NOT NULL
    AND starting_petty_cash > 0
  ORDER BY start_time DESC
  LIMIT 1;

  -- Reset ke setoran awal standar bila ada riwayat; jika tidak, seeding dari input klien.
  v_starting := COALESCE(v_prev_starting, p_starting_petty_cash);

  IF v_starting IS NULL OR v_starting < 0 THEN
    RAISE EXCEPTION 'Saldo awal Dana Operasional tidak valid';
  END IF;

  -- Insert new shift, modal laci (starting_cash) selalu 0, Dana Operasional = v_starting
  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, auth.uid(), 0, v_starting, 'open')
  RETURNING id INTO v_shift_id;

  RETURN v_shift_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;
