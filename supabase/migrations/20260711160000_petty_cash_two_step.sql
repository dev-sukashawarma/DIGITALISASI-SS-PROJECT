-- 20260711160000_petty_cash_two_step.sql
-- Modify petty_cash_topups for two-step approval flow (Leader -> Finance)

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

-- Add new constraint allowing 'forwarded'
ALTER TABLE public.petty_cash_topups 
  ADD CONSTRAINT petty_cash_topups_status_check 
  CHECK (status IN ('pending', 'forwarded', 'approved', 'rejected'));

-- Add disbursement and tracking columns
ALTER TABLE public.petty_cash_topups
  ADD COLUMN IF NOT EXISTS disbursement_method TEXT CHECK (disbursement_method IN ('potong_setoran', 'transfer', 'tunai')),
  ADD COLUMN IF NOT EXISTS disbursed_from_cash_location_id UUID REFERENCES public.cash_location(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL;

-- Update existing RPC review_petty_cash_topup to handle 'forward' action by leader
CREATE OR REPLACE FUNCTION public.review_petty_cash_topup(
  p_topup_id UUID,
  p_action TEXT -- 'approve' (to forward), 'reject'
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

  IF v_topup.status != 'pending' THEN
    RAISE EXCEPTION 'Top up is already %', v_topup.status;
  END IF;

  IF p_action = 'approve' THEN
    -- In 2-step flow, leader approval sets it to 'forwarded'
    UPDATE public.petty_cash_topups 
    SET status = 'forwarded', approved_by = auth.uid(), approved_at = NOW()
    WHERE id = p_topup_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups 
    SET status = 'rejected', approved_by = auth.uid(), approved_at = NOW()
    WHERE id = p_topup_id;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_petty_cash_topup(UUID, TEXT) TO authenticated;

-- Create new RPC for Finance Admin to process the forwarded request
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

  IF v_topup.status != 'forwarded' THEN
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
      status = 'approved', 
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
