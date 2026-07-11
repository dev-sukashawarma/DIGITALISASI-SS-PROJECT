-- 20260711200000_reconcile_bogor_routing.sql
-- Reconciles concurrent work on petty-cash Korlap routing and closes a gap
-- where an earlier local edit to 20260711170000_petty_cash_korlap.sql never
-- actually reached the remote database (that version was already recorded
-- against an earlier, unedited push, so the edited content was silently
-- dropped). Confirmed live via `supabase db query --linked`:
--   - outlets.requires_korlap_review does not exist
--   - korlap_process_petty_cash has no caller authorization check
--   - review_petty_cash_topup still does a single inline '%bogor%' ILIKE check
--
-- This migration:
--   1. Adds outlets.requires_korlap_review (never actually created).
--   2. Backfills it using the full Bogor-area pattern list (from
--      20260711195000_fix_petty_cash_bogor_check.sql, applied directly by a
--      teammate, which corrected the single '%bogor%' match to also include
--      Empang/Cimanggu/Pajajaran/Tajur/Cibinong/Yasmin/Sukasari/Ciomas/
--      Dramaga/Parung).
--   3. Points review_petty_cash_topup at the column instead of inline ILIKE.
--   4. Re-applies the stuck-row repair so no already-misrouted request is
--      left stranded in 'forwarded_to_korlap'.
--   5. Adds the caller authorization check to korlap_process_petty_cash
--      (role must be korlap/admin/admin_finance/owner, and the topup's
--      outlet must be in accessible_outlet_ids()) that was intended in
--      20260711170000 but never shipped.

-- 1. Add the routing column (idempotent; never actually created live).
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS requires_korlap_review BOOLEAN NOT NULL DEFAULT true;

-- 2. Backfill with the full Bogor-area pattern list.
-- name/address can be NULL (e.g. HQ/warehouse outlets), which would make the
-- OR-expression evaluate to NULL instead of false and violate the NOT NULL
-- constraint on requires_korlap_review — coalesce to '' to keep it boolean.
UPDATE public.outlets
SET requires_korlap_review = NOT (
  COALESCE(name, '') ILIKE '%bogor%' OR
  COALESCE(name, '') ILIKE '%empang%' OR
  COALESCE(name, '') ILIKE '%cimanggu%' OR
  COALESCE(name, '') ILIKE '%pajajaran%' OR
  COALESCE(name, '') ILIKE '%tajur%' OR
  COALESCE(name, '') ILIKE '%cibinong%' OR
  COALESCE(name, '') ILIKE '%yasmin%' OR
  COALESCE(name, '') ILIKE '%sukasari%' OR
  COALESCE(name, '') ILIKE '%ciomas%' OR
  COALESCE(name, '') ILIKE '%dramaga%' OR
  COALESCE(name, '') ILIKE '%parung%' OR
  COALESCE(address, '') ILIKE '%bogor%'
);

-- 3. Point review_petty_cash_topup back at the column instead of inline ILIKE.
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

-- 4. Re-apply the stuck-row repair now that the column exists and is backfilled.
UPDATE public.petty_cash_topups pt
SET status = 'forwarded_to_finance'
FROM public.outlets o
WHERE pt.outlet_id = o.id
  AND pt.status = 'forwarded_to_korlap'
  AND o.requires_korlap_review = false;

-- 5. Add the caller authorization check to korlap_process_petty_cash.
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
