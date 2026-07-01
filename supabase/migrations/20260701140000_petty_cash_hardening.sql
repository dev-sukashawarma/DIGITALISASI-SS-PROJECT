-- 20260701140000_petty_cash_hardening.sql
-- Petty Cash canggih + anti-curang + otomatis.
-- Fokus: pencatatan pengeluaran tunai operasional (mis. beli galon) yang
-- ter-audit (siapa & kapan), immutable bagi kasir, server-authoritative.

-- ============================================================
-- 1. Kolom audit (siapa mencatat)
-- ============================================================
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);

-- ============================================================
-- 2. Kunci RLS — entri kasir immutable (anti-curang)
--    Sebelumnya UPDATE/DELETE/INSERT = USING(true) (siapa pun bisa ubah/hapus
--    pengeluaran outlet mana pun). Kini:
--      - INSERT: hanya untuk outlet yang boleh diakses (scoped)
--      - UPDATE/DELETE: hanya admin/owner (koreksi terkontrol)
--    SELECT dibiarkan (sudah di-scope oleh migrasi mitra 20260629100000).
-- ============================================================
DROP POLICY IF EXISTS "expenses_insert_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_all" ON public.expenses;

CREATE POLICY "expenses_insert_scoped" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

CREATE POLICY "expenses_update_admin" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'owner'))
  WITH CHECK (public.get_user_role() IN ('admin', 'owner'));

CREATE POLICY "expenses_delete_admin" ON public.expenses
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('admin', 'owner'));

-- ============================================================
-- 3. RPC add_petty_cash — server-authoritative (SECURITY DEFINER)
--    Stempel created_by = auth.uid(), outlet dari staff (abaikan input client),
--    tanggal hari ini, payment_source cash_drawer (trigger auto-link shift aktif
--    & menolak bila tak ada shift terbuka).
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_petty_cash(
  p_category TEXT,
  p_amount DECIMAL,
  p_description TEXT
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet UUID;
  v_row public.expenses;
BEGIN
  SELECT outlet_id INTO v_outlet FROM public.outlet_staff WHERE id = auth.uid();
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'Akun Anda tidak terhubung ke outlet manapun';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran harus lebih dari 0';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Keterangan pengeluaran wajib diisi';
  END IF;

  IF p_category NOT IN ('bahan_baku', 'operasional', 'utilitas', 'lainnya') THEN
    RAISE EXCEPTION 'Kategori tidak valid';
  END IF;

  INSERT INTO public.expenses (
    outlet_id, category, amount, description, expense_date,
    payment_source, created_by
  )
  VALUES (
    v_outlet, p_category, p_amount, btrim(p_description), CURRENT_DATE,
    'cash_drawer', auth.uid()
  )
  RETURNING * INTO v_row;  -- trigger trg_link_expense_to_shift mengisi shift_id

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_petty_cash(TEXT, DECIMAL, TEXT) TO authenticated;
