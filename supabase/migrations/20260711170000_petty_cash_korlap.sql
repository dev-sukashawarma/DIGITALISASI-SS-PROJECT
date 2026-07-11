-- 20260711170000_petty_cash_korlap.sql
-- Modify petty_cash_topups for three-step approval flow (Crew -> Leader -> Korlap -> Finance) based on region

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

-- Migrate any rows still carrying the old 2-step 'forwarded' status before the
-- stricter CHECK constraint below is validated against existing data.
UPDATE public.petty_cash_topups SET status = 'forwarded_to_finance' WHERE status = 'forwarded';

-- Add new constraint allowing 'forwarded_to_korlap' and 'forwarded_to_finance'
ALTER TABLE public.petty_cash_topups
  ADD CONSTRAINT petty_cash_topups_status_check
  CHECK (status IN ('pending', 'forwarded_to_korlap', 'forwarded_to_finance', 'approved', 'rejected'));

-- Add column for Korlap approval
ALTER TABLE public.petty_cash_topups
  ADD COLUMN IF NOT EXISTS korlap_approved_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL;

-- Explicit per-outlet routing flag, replacing name/address string-matching.
-- Backfilled once from the previous ILIKE '%bogor%' heuristic so behavior is unchanged;
-- going forward this should be toggled directly instead of relying on outlet name/address text.
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS requires_korlap_review BOOLEAN NOT NULL DEFAULT true;

UPDATE public.outlets
SET requires_korlap_review = NOT (address ILIKE '%bogor%' OR name ILIKE '%bogor%');

-- Update existing RPC review_petty_cash_topup to route via outlets.requires_korlap_review
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
  v_needs_korlap BOOLEAN := true;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'pending' THEN
    RAISE EXCEPTION 'Top up is already %', v_topup.status;
  END IF;

  SELECT requires_korlap_review INTO v_needs_korlap FROM public.outlets WHERE id = v_topup.outlet_id;
  v_needs_korlap := COALESCE(v_needs_korlap, true);

  IF p_action = 'approve' THEN
    IF v_needs_korlap THEN
      -- Luar Bogor ke Korlap dulu
      UPDATE public.petty_cash_topups
      SET status = 'forwarded_to_korlap', approved_by = auth.uid(), approved_at = NOW()
      WHERE id = p_topup_id;
    ELSE
      -- Bogor langsung ke Finance
      UPDATE public.petty_cash_topups
      SET status = 'forwarded_to_finance', approved_by = auth.uid(), approved_at = NOW()
      WHERE id = p_topup_id;
    END IF;
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

-- Create new RPC for Korlap to process the forwarded_to_korlap request
CREATE OR REPLACE FUNCTION public.korlap_process_petty_cash(
  p_topup_id UUID,
  p_action TEXT -- 'approve' or 'reject'
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

  IF v_topup.status != 'forwarded_to_korlap' THEN
    RAISE EXCEPTION 'Top up is not ready for Korlap processing (status: %)', v_topup.status;
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('korlap', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Not authorized to process Korlap petty cash requests';
  END IF;

  IF v_topup.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to process this outlet''s petty cash request';
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
GRANT EXECUTE ON FUNCTION public.korlap_process_petty_cash(UUID, TEXT) TO authenticated;

-- Update existing RPC finance_process_petty_cash to handle 'forwarded_to_finance'
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
        description,
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
