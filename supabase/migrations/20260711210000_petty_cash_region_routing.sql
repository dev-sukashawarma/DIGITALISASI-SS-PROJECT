-- 20260711210000_petty_cash_region_routing.sql

-- 1. Update review_petty_cash_topup to use the region column
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
  v_region TEXT;
BEGIN
  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top up request not found';
  END IF;

  IF v_topup.status != 'pending' THEN
    RAISE EXCEPTION 'Top up is already %', v_topup.status;
  END IF;

  SELECT region INTO v_region FROM public.outlets WHERE id = v_topup.outlet_id;
  
  -- Prevent routing if region is not set (based on interview decision)
  IF v_region IS NULL OR trim(v_region) = '' THEN
    RAISE EXCEPTION 'Region outlet belum diatur. Harap hubungi Admin.';
  END IF;

  IF p_action = 'approve' THEN
    IF upper(v_region) = 'BOGOR' THEN
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


-- 2. Restore global access for Korlap Global accounts based on region
-- This allows users with 'korlap' role to see all non-Bogor outlets globally
-- IN ADDITION to any specific outlets assigned via staff_outlets.
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  -- Role yang bisa akses SEMUA outlet
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'admin_finance')
  
  UNION
  
  -- Role korlap bisa akses SEMUA outlet non-Bogor berdasarkan region (Korlap Global)
  SELECT o.id FROM public.outlets o, me
    WHERE me.role = 'korlap' AND (o.region IS NULL OR upper(o.region) != 'BOGOR')

  UNION
  
  -- Akses spesifik yang di-assign via staff_outlets (misal untuk leader/korlap regional)
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role IN ('leader', 'korlap') AND so.staff_id = me.id
    
  UNION
  
  -- Akses dari kolom outlet_id di tabel outlet_staff
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$$;

-- 3. Data Patching:
-- Mengubah request Bogor yang sebelumnya salah dikirim ke Korlap menjadi dikirim ke Finance
UPDATE public.petty_cash_topups pt
SET status = 'forwarded_to_finance'
FROM public.outlets o
WHERE pt.outlet_id = o.id
  AND pt.status = 'forwarded_to_korlap'
  AND upper(o.region) = 'BOGOR';
