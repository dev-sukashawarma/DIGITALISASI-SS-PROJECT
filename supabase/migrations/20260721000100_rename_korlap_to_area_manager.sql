-- Migration: Rename korlap to area_manager
-- This migration attempts to seamlessly rename the 'korlap' role to 'area_manager'

-- 1. Rename enum value if it is an enum
DO $$
BEGIN
  -- Try to rename the enum value if user_role is an ENUM type
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typtype = 'e') THEN
    ALTER TYPE user_role RENAME VALUE 'korlap' TO 'area_manager';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors (e.g., if value already exists or not an enum)
  NULL;
END $$;

-- 2. Update existing records in outlet_staff (if it's a text column or castable)
DO $$
BEGIN
  UPDATE public.outlet_staff SET role = 'area_manager' WHERE role = 'korlap';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Update petty cash transaction statuses
DO $$
BEGIN
  UPDATE public.petty_cash_transactions
  SET status = 'forwarded_to_area_manager'
  WHERE status = 'forwarded_to_korlap';

  UPDATE public.petty_cash_transactions
  SET status = 'forwarded_by_area_manager'
  WHERE status = 'forwarded_by_korlap';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Re-create the processing function with the new name
CREATE OR REPLACE FUNCTION public.area_manager_process_petty_cash(
  p_transaction_id UUID,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_topup RECORD;
  v_caller_role TEXT;
  v_needs_area_manager BOOLEAN;
BEGIN
  -- Dapatkan role dari caller
  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  
  -- Ambil data topup saat ini
  SELECT * INTO v_topup FROM public.petty_cash_transactions WHERE id = p_transaction_id FOR UPDATE;
  
  IF v_topup IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_topup.status != 'forwarded_to_area_manager' THEN
    RAISE EXCEPTION 'Top up is not ready for Area Manager processing (status: %)', v_topup.status;
  END IF;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('area_manager', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to process Area Manager petty cash requests';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.petty_cash_transactions
    SET status = 'forwarded_to_finance', korlap_approved_by = auth.uid()
    WHERE id = p_transaction_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_transactions
    SET status = 'rejected', korlap_approved_by = auth.uid()
    WHERE id = p_transaction_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.area_manager_process_petty_cash(UUID, TEXT) TO authenticated;
