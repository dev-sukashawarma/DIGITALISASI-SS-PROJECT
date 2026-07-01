-- 20260701130000_create_shifts_blind_close.sql
-- Implementasi Shift Kasir & Blind Close System

-- 1. Create shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  closed_by UUID REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  starting_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  actual_ending_cash DECIMAL(12,2),
  expected_ending_cash DECIMAL(12,2),
  variance DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one open shift per outlet
CREATE UNIQUE INDEX idx_unique_open_shift ON public.shifts (outlet_id) WHERE status = 'open';
CREATE INDEX idx_shifts_outlet_time ON public.shifts(outlet_id, start_time DESC);

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_select_all" ON public.shifts FOR SELECT TO authenticated USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
CREATE POLICY "shifts_insert_all" ON public.shifts FOR INSERT TO authenticated WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));
CREATE POLICY "shifts_update_all" ON public.shifts FOR UPDATE TO authenticated USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;


-- 2. Alter expenses table
ALTER TABLE public.expenses 
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'cash_drawer' CHECK (payment_source IN ('cash_drawer', 'transfer_pusat'));

-- Trigger to auto-link cash expenses to active shift
CREATE OR REPLACE FUNCTION public.link_expense_to_shift()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_shift_id UUID;
BEGIN
  IF NEW.payment_source = 'cash_drawer' THEN
    SELECT id INTO v_shift_id FROM public.shifts 
    WHERE outlet_id = NEW.outlet_id AND status = 'open' LIMIT 1;
    
    IF v_shift_id IS NULL THEN
      RAISE EXCEPTION 'Cannot record cash_drawer expense because there is no open shift for this outlet';
    END IF;
    
    NEW.shift_id := v_shift_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_expense_to_shift ON public.expenses;
CREATE TRIGGER trg_link_expense_to_shift
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.link_expense_to_shift();


-- 3. RPCs

-- open_shift
CREATE OR REPLACE FUNCTION public.open_shift(p_outlet_id UUID, p_starting_cash DECIMAL)
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

  -- Insert new shift
  INSERT INTO public.shifts (outlet_id, staff_id, starting_cash, status)
  VALUES (p_outlet_id, auth.uid(), p_starting_cash, 'open')
  RETURNING id INTO v_shift_id;
  
  RETURN v_shift_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_shift(UUID, DECIMAL) TO authenticated;

-- get_expected_shift_cash
CREATE OR REPLACE FUNCTION public.get_expected_shift_cash(p_shift_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift RECORD;
  v_cash_sales DECIMAL := 0;
  v_cash_expenses DECIMAL := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;

  IF v_shift.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this shift';
  END IF;

  -- Sum of cash orders completed in this time range
  SELECT COALESCE(SUM(total_amount), 0) INTO v_cash_sales
  FROM public.orders
  WHERE outlet_id = v_shift.outlet_id
    AND payment_method = 'cash'
    AND status = 'completed'
    AND created_at >= v_shift.start_time
    AND created_at <= COALESCE(v_shift.end_time, NOW());
    
  -- Sum of petty cash expenses tied to this shift
  SELECT COALESCE(SUM(amount), 0) INTO v_cash_expenses
  FROM public.expenses
  WHERE shift_id = p_shift_id
    AND payment_source = 'cash_drawer';
    
  RETURN v_shift.starting_cash + v_cash_sales - v_cash_expenses;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_expected_shift_cash(UUID) TO authenticated;

-- close_shift_blind
CREATE OR REPLACE FUNCTION public.close_shift_blind(p_shift_id UUID, p_actual_cash DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected DECIMAL;
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
  
  -- Calculate expected cash
  v_expected := public.get_expected_shift_cash(p_shift_id);
  
  -- Finalize shift
  UPDATE public.shifts
  SET 
    status = 'closed',
    closed_by = auth.uid(),
    expected_ending_cash = v_expected,
    actual_ending_cash = p_actual_cash,
    variance = p_actual_cash - v_expected,
    updated_at = NOW()
  WHERE id = p_shift_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_shift_blind(UUID, DECIMAL) TO authenticated;
