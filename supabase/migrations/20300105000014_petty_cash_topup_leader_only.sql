-- Pengajuan petty cash hanya boleh dibuat Leader ke atas -- crew/kasir/kiosk tidak.
--
-- Sebelumnya create_petty_cash_topup nol pemeriksaan role (SECURITY DEFINER,
-- GRANT ke authenticated) dan policy INSERT hanya memeriksa outlet, jadi crew
-- mana pun bisa membuat pengajuan atas nama outletnya.

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
  v_caller_role TEXT;
BEGIN
  v_caller_staff_id := auth.uid();
  IF v_caller_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_caller_role FROM public.outlet_staff
  WHERE id = v_caller_staff_id AND status = 'active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('leader', 'area_manager', 'korlap', 'regional_manager', 'admin', 'admin_finance', 'owner') THEN
    RAISE EXCEPTION 'Hanya Leader ke atas yang boleh mengajukan petty cash (role: %)', COALESCE(v_caller_role, 'tidak aktif/tidak dikenal');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengajuan tidak valid';
  END IF;

  IF p_bank_name IS NOT NULL AND p_bank_account_number IS NOT NULL THEN
    UPDATE public.outlets
    SET
      bank_name = p_bank_name,
      bank_account_number = p_bank_account_number,
      bank_account_name = COALESCE(p_bank_account_name, bank_account_name)
    WHERE id = p_outlet_id;
  END IF;

  INSERT INTO public.petty_cash_topups (
    outlet_id, amount, description, status, created_by, created_at,
    bank_name, bank_account_number, bank_account_name
  ) VALUES (
    p_outlet_id, p_amount, p_description, 'forwarded_to_area_manager',
    v_caller_staff_id, NOW(),
    p_bank_name, p_bank_account_number, p_bank_account_name
  )
  RETURNING id INTO v_topup_id;

  RETURN v_topup_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_petty_cash_topup(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Tutup juga jalur INSERT langsung ke tabel (tanpa RPC).
DROP POLICY IF EXISTS petty_cash_topups_insert ON public.petty_cash_topups;
CREATE POLICY petty_cash_topups_insert ON public.petty_cash_topups
  FOR INSERT TO authenticated
  WITH CHECK (
    outlet_id IN (SELECT accessible_outlet_ids())
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('leader', 'area_manager', 'korlap', 'regional_manager', 'admin', 'admin_finance', 'owner')
    )
  );
