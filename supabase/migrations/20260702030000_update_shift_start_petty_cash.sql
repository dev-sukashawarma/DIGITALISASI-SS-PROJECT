-- 20260702030000_update_shift_start_petty_cash.sql
-- Mengubah input awal shift menjadi Petty Cash bukan Laci Kasir

-- 1. Tambah kolom starting_petty_cash di tabel shifts
ALTER TABLE public.shifts 
  ADD COLUMN IF NOT EXISTS starting_petty_cash DECIMAL(12,2) DEFAULT 0;

-- 2. Update fungsi open_shift
DROP FUNCTION IF EXISTS public.open_shift(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_petty_cash DECIMAL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id UUID;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized for this outlet';
  END IF;
  
  -- Check if there's already an open shift for this outlet
  IF EXISTS (SELECT 1 FROM public.shifts WHERE outlet_id = p_outlet_id AND status = 'open') THEN
    RAISE EXCEPTION 'There is already an open shift for this outlet';
  END IF;

  -- Insert new shift, modal laci (starting_cash) selalu 0, input user masuk ke starting_petty_cash
  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, starting_petty_cash, status)
  VALUES (p_outlet_id, auth.uid(), 0, p_starting_petty_cash, 'open')
  RETURNING id INTO v_shift_id;
  
  RETURN v_shift_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;
