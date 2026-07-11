-- 20260711190000_fix_petty_cash_bogor_check.sql
-- Fix the Bogor check in review_petty_cash_topup to include all Bogor branches
-- and fix any stuck petty cash requests.

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
  v_outlet RECORD;
  v_is_bogor BOOLEAN := false;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'pending' THEN
    RAISE EXCEPTION 'Top up is already %', v_topup.status;
  END IF;

  -- Cek data outlet untuk mendeteksi apakah di Bogor
  SELECT * INTO v_outlet FROM public.outlets WHERE id = v_topup.outlet_id;
  IF FOUND THEN
    IF v_outlet.name ILIKE '%bogor%' OR 
       v_outlet.name ILIKE '%empang%' OR 
       v_outlet.name ILIKE '%cimanggu%' OR 
       v_outlet.name ILIKE '%pajajaran%' OR 
       v_outlet.name ILIKE '%tajur%' OR 
       v_outlet.name ILIKE '%cibinong%' OR 
       v_outlet.name ILIKE '%yasmin%' OR 
       v_outlet.name ILIKE '%sukasari%' OR 
       v_outlet.name ILIKE '%ciomas%' OR 
       v_outlet.name ILIKE '%dramaga%' OR 
       v_outlet.name ILIKE '%parung%' OR
       v_outlet.address ILIKE '%bogor%' THEN
      v_is_bogor := true;
    END IF;
  END IF;

  IF p_action = 'approve' THEN
    IF v_is_bogor THEN
      -- Bogor langsung ke Finance
      UPDATE public.petty_cash_topups 
      SET status = 'forwarded_to_finance', approved_by = auth.uid(), approved_at = NOW()
      WHERE id = p_topup_id;
    ELSE
      -- Luar Bogor ke Korlap dulu
      UPDATE public.petty_cash_topups 
      SET status = 'forwarded_to_korlap', approved_by = auth.uid(), approved_at = NOW()
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

-- Fix existing requests that were mistakenly forwarded to Korlap but belong to Bogor
UPDATE public.petty_cash_topups pt
SET status = 'forwarded_to_finance'
FROM public.outlets o
WHERE pt.outlet_id = o.id
  AND pt.status = 'forwarded_to_korlap'
  AND (
       o.name ILIKE '%bogor%' OR 
       o.name ILIKE '%empang%' OR 
       o.name ILIKE '%cimanggu%' OR 
       o.name ILIKE '%pajajaran%' OR 
       o.name ILIKE '%tajur%' OR 
       o.name ILIKE '%cibinong%' OR 
       o.name ILIKE '%yasmin%' OR 
       o.name ILIKE '%sukasari%' OR 
       o.name ILIKE '%ciomas%' OR 
       o.name ILIKE '%dramaga%' OR 
       o.name ILIKE '%parung%' OR
       o.address ILIKE '%bogor%'
  );
