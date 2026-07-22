-- 20260722110000_update_petty_cash_flow_and_bank.sql
-- Migration for Full Hierarchy Petty Cash Flow & Outlet Bank Account Persistence

-- 1. Add bank account columns to outlets table if not exists
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

-- 2. Add bank account snapshot columns & tracking columns to petty_cash_topups if not exists
ALTER TABLE public.petty_cash_topups
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS finance_forwarded_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finance_forwarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS area_manager_forwarded_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_manager_forwarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS leader_forwarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_of_transfer_url TEXT;

-- 3. Update existing old status 'approved' to 'completed' so check constraint won't fail on legacy data
UPDATE public.petty_cash_topups
SET status = 'completed'
WHERE status = 'approved';

-- 4. Update status check constraint on petty_cash_topups
DO $$
DECLARE
    r record;
BEGIN
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

ALTER TABLE public.petty_cash_topups
  ADD CONSTRAINT petty_cash_topups_status_check
  CHECK (status IN (
    'pending', 
    'forwarded_to_area_manager', 
    'forwarded_to_finance', 
    'approved_by_finance',
    'forwarded_by_finance',
    'forwarded_by_area_manager', 
    'forwarded_by_leader', 
    'completed', 
    'rejected',
    'approved'
  ));

-- DROP OLD FUNCTIONS FIRST TO PREVENT PARAMETER NAME CONFLICTS
DROP FUNCTION IF EXISTS public.create_petty_cash_topup CASCADE;
DROP FUNCTION IF EXISTS public.area_manager_process_petty_cash CASCADE;
DROP FUNCTION IF EXISTS public.finance_process_petty_cash CASCADE;
DROP FUNCTION IF EXISTS public.finance_forward_funds CASCADE;
DROP FUNCTION IF EXISTS public.area_manager_forward_funds CASCADE;
DROP FUNCTION IF EXISTS public.leader_forward_funds CASCADE;
DROP FUNCTION IF EXISTS public.crew_receive_funds CASCADE;

-- 5. RPC: Create Petty Cash Topup (Leader creates, updates outlet bank if provided)
CREATE OR REPLACE FUNCTION public.create_petty_cash_topup(
  p_outlet_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account_number TEXT DEFAULT NULL,
  p_bank_account_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topup_id UUID;
  v_caller_staff_id UUID;
BEGIN
  v_caller_staff_id := auth.uid();
  IF v_caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Save / update outlet bank details if provided
  IF p_bank_name IS NOT NULL AND p_bank_account_number IS NOT NULL THEN
    UPDATE public.outlets
    SET 
      bank_name = p_bank_name,
      bank_account_number = p_bank_account_number,
      bank_account_name = COALESCE(p_bank_account_name, bank_account_name)
    WHERE id = p_outlet_id;
  END IF;

  INSERT INTO public.petty_cash_topups (
    outlet_id,
    amount,
    description,
    status,
    created_by,
    created_at,
    bank_name,
    bank_account_number,
    bank_account_name
  ) VALUES (
    p_outlet_id,
    p_amount,
    p_description,
    'forwarded_to_area_manager',
    v_caller_staff_id,
    NOW(),
    p_bank_name,
    p_bank_account_number,
    p_bank_account_name
  )
  RETURNING id INTO v_topup_id;

  RETURN v_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_petty_cash_topup(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 6. RPC: Area Manager Process (Approve to Finance / Reject)
CREATE OR REPLACE FUNCTION public.area_manager_process_petty_cash(
  p_topup_id UUID,
  p_action TEXT
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

  IF v_topup.status NOT IN ('pending', 'forwarded_to_area_manager') THEN
    RAISE EXCEPTION 'Top up is not ready for Area Manager processing (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to process Area Manager petty cash requests';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.petty_cash_topups 
    SET status = 'forwarded_to_finance', korlap_approved_by = auth.uid()
    WHERE id = p_topup_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups 
    SET status = 'rejected', korlap_approved_by = auth.uid()
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.area_manager_process_petty_cash(UUID, TEXT) TO authenticated;

-- 7. RPC: Finance Process (Approve with Transfer/Cash / Reject)
CREATE OR REPLACE FUNCTION public.finance_process_petty_cash(
  p_topup_id UUID,
  p_action TEXT,
  p_method TEXT DEFAULT 'transfer',
  p_cash_location_id UUID DEFAULT NULL,
  p_proof_of_transfer_url TEXT DEFAULT NULL
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
      p_method := 'transfer';
    END IF;

    UPDATE public.petty_cash_topups 
    SET 
      status = 'approved_by_finance', 
      finance_approved_by = auth.uid(),
      disbursement_method = p_method,
      disbursed_from_cash_location_id = p_cash_location_id,
      proof_of_transfer_url = p_proof_of_transfer_url
    WHERE id = p_topup_id;

    -- Record Cash Out in Finance Treasury if location specified
    IF p_cash_location_id IS NOT NULL THEN
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
        'Pencairan Petty Cash Outlet (' || p_method || ')',
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
GRANT EXECUTE ON FUNCTION public.finance_process_petty_cash(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- 8. RPC: Finance Forward Funds to Area Manager
CREATE OR REPLACE FUNCTION public.finance_forward_funds(
  p_topup_id UUID
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

  IF v_topup.status != 'approved_by_finance' THEN
    RAISE EXCEPTION 'Top up is not approved by Finance (status: %)', v_topup.status;
  END IF;

  UPDATE public.petty_cash_topups 
  SET 
    status = 'forwarded_by_finance', 
    finance_forwarded_by = auth.uid(),
    finance_forwarded_at = NOW()
  WHERE id = p_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.finance_forward_funds(UUID) TO authenticated;

-- 9. RPC: Area Manager Forward Funds to Leader
CREATE OR REPLACE FUNCTION public.area_manager_forward_funds(
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

  IF v_topup.status NOT IN ('approved_by_finance', 'forwarded_by_finance') THEN
    RAISE EXCEPTION 'Top up is not ready for Area Manager forwarding (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Area Manager funds';
  END IF;

  UPDATE public.petty_cash_topups 
  SET 
    status = 'forwarded_by_area_manager', 
    area_manager_forwarded_by = auth.uid(),
    area_manager_forwarded_at = NOW(),
    korlap_forwarded_by = auth.uid()
  WHERE id = p_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.area_manager_forward_funds(UUID) TO authenticated;

-- 10. RPC: Leader Forward Funds to Crew (Increases Petty Cash Balance!)
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
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_by_area_manager' THEN
    RAISE EXCEPTION 'Top up is not ready for Leader forwarding (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to forward Leader funds';
  END IF;

  -- Update topup status
  UPDATE public.petty_cash_topups 
  SET 
    status = 'forwarded_by_leader', 
    leader_forwarded_by = auth.uid(),
    leader_forwarded_at = NOW()
  WHERE id = p_topup_id;

  -- Increase Petty Cash balance of the outlet
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'petty_cash_transactions') THEN
    INSERT INTO public.petty_cash_transactions (
      outlet_id,
      amount,
      type,
      description,
      created_by,
      created_at
    ) VALUES (
      v_topup.outlet_id,
      v_topup.amount,
      'topup',
      'Topup Petty Cash diserahkan oleh Leader',
      auth.uid(),
      NOW()
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.leader_forward_funds(UUID) TO authenticated;

-- 11. RPC: Crew Receive Funds (Completes flow)
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
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'forwarded_by_leader' THEN
    RAISE EXCEPTION 'Top up is not ready for Crew receiving (status: %)', v_topup.status;
  END IF;

  UPDATE public.petty_cash_topups 
  SET 
    status = 'completed', 
    crew_received_by = auth.uid(), 
    completed_at = NOW()
  WHERE id = p_topup_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.crew_receive_funds(UUID) TO authenticated;
