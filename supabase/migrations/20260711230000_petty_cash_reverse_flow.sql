-- 20260711180000_petty_cash_reverse_flow.sql
-- Add reverse flow statuses and RPCs for downward flow: Finance -> Korlap -> Leader -> Crew

DO $$
DECLARE
    r record;
BEGIN
    -- Drop existing check constraints on the status column
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.petty_cash_topups'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.petty_cash_topups DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END
$$;

-- Add new constraint with downward flow statuses
ALTER TABLE public.petty_cash_topups
  ADD CONSTRAINT petty_cash_topups_status_check
  CHECK (status IN (
    'pending', 
    'forwarded_to_korlap', 
    'forwarded_to_finance', 
    'approved', -- (legacy)
    'approved_by_finance', 
    'forwarded_by_korlap', 
    'forwarded_by_leader', 
    'completed', 
    'rejected'
  ));

-- Track forwarding actions
ALTER TABLE public.petty_cash_topups
  ADD COLUMN IF NOT EXISTS korlap_forwarded_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leader_forwarded_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_received_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 1. Update finance_process_petty_cash to set status to 'approved_by_finance'
CREATE OR REPLACE FUNCTION public.finance_process_petty_cash(
  p_topup_id UUID,
  p_action TEXT, -- 'approve' or 'reject'
  p_method TEXT DEFAULT NULL, -- 'potong_setoran', 'transfer', 'tunai'
  p_cash_location_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_to_finance' THEN
    RAISE EXCEPTION 'Top up is not ready for finance processing (status: %)', v_topup.status;
  END IF;

  IF p_action = 'approve' THEN
    IF p_method IS NULL THEN
      RAISE EXCEPTION 'Disbursement method is required for approval';
    END IF;

    IF p_method IN ('transfer', 'tunai') AND p_cash_location_id IS NULL THEN
      RAISE EXCEPTION 'Cash location ID is required for transfer/tunai disbursement';
    END IF;

    UPDATE public.petty_cash_topups 
    SET 
      status = 'approved_by_finance', 
      finance_approved_by = auth.uid(),
      disbursement_method = p_method,
      disbursed_from_cash_location_id = p_cash_location_id
    WHERE id = p_topup_id;

    -- If money is taken from Finance Cash Location (transfer/tunai), insert into cash_transaction
    IF p_method IN ('transfer', 'tunai') THEN
      INSERT INTO public.cash_transaction (
        cash_location_id, 
        amount, 
        direction, 
        source_type, 
        source_id, 
        note,
        occurred_at,
        created_by
      ) VALUES (
        p_cash_location_id,
        v_topup.amount,
        'out',
        'petty_cash_topup',
        p_topup_id,
        'Pencairan Petty Cash Outlet',
        NOW(),
        auth.uid()
      );
    END IF;

  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups 
    SET status = 'rejected', finance_approved_by = auth.uid()
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.finance_process_petty_cash(UUID, TEXT, TEXT, UUID) TO authenticated;

-- 2. New RPC: Korlap Forward Funds
CREATE OR REPLACE FUNCTION public.korlap_forward_funds(
  p_topup_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
  v_needs_korlap BOOLEAN;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'approved_by_finance' THEN
    RAISE EXCEPTION 'Top up is not ready for Korlap forwarding (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Korlap funds';
  END IF;

  IF v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to process this outlet''s petty cash request';
  END IF;

  SELECT requires_korlap_review INTO v_needs_korlap FROM public.outlets WHERE id = v_topup.outlet_id;
  v_needs_korlap := COALESCE(v_needs_korlap, true);
  IF NOT v_needs_korlap THEN
    RAISE EXCEPTION 'This outlet does not require Korlap step';
  END IF;

  UPDATE public.petty_cash_topups 
  SET status = 'forwarded_by_korlap', korlap_forwarded_by = auth.uid()
  WHERE id = p_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.korlap_forward_funds(UUID) TO authenticated;

-- 3. New RPC: Leader Forward Funds
CREATE OR REPLACE FUNCTION public.leader_forward_funds(
  p_topup_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
  v_needs_korlap BOOLEAN;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  SELECT requires_korlap_review INTO v_needs_korlap FROM public.outlets WHERE id = v_topup.outlet_id;
  v_needs_korlap := COALESCE(v_needs_korlap, true);

  IF v_needs_korlap AND v_topup.status != 'forwarded_by_korlap' THEN
    RAISE EXCEPTION 'Top up is not ready for Leader forwarding (status: %)', v_topup.status;
  END IF;
  
  IF NOT v_needs_korlap AND v_topup.status != 'approved_by_finance' THEN
    RAISE EXCEPTION 'Top up is not ready for Leader forwarding (status: %)', v_topup.status;
  END IF;

  -- Leader verification
  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Leader funds';
  END IF;

  IF v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to process this outlet''s petty cash request';
  END IF;

  UPDATE public.petty_cash_topups 
  SET status = 'forwarded_by_leader', leader_forwarded_by = auth.uid()
  WHERE id = p_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.leader_forward_funds(UUID) TO authenticated;

-- 4. New RPC: Crew Receive Funds
CREATE OR REPLACE FUNCTION public.crew_receive_funds(
  p_topup_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_by_leader' THEN
    RAISE EXCEPTION 'Top up is not ready for Crew receiving (status: %)', v_topup.status;
  END IF;

  -- Staff verification (Crew, Leader, etc inside the outlet)
  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized (staff only)';
  END IF;

  IF v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to process this outlet''s petty cash request';
  END IF;

  UPDATE public.petty_cash_topups 
  SET status = 'completed', crew_received_by = auth.uid(), completed_at = NOW()
  WHERE id = p_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crew_receive_funds(UUID) TO authenticated;
