-- 20260806040305_add_type_to_expenses.sql

-- 1. Tambah kolom type di expenses dan petty_cash_expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense'));
ALTER TABLE public.petty_cash_expenses ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense'));

-- 2. Drop constraints category di petty_cash_expenses jika ada
ALTER TABLE public.petty_cash_expenses DROP CONSTRAINT IF EXISTS petty_cash_expenses_category_check;

-- 3. Mapping data lama expenses
UPDATE public.expenses SET category = 'utilities' WHERE category IN ('pln', 'pdam', 'internet', 'utilitas');
UPDATE public.expenses SET category = 'overtime' WHERE category = 'lembur';
UPDATE public.expenses SET category = 'outlet' WHERE category IN ('pengeluaran_outlet', 'sewa_outlet', 'gaji_crew_outlet', 'bonus_leader', 'bonus_area_manager', 'gaji', 'sewa', 'operasional', 'lainnya');
UPDATE public.expenses SET category = 'admin' WHERE category IN ('pengeluaran_global', 'gaji_staff_kantor');
UPDATE public.expenses SET category = 'ads' WHERE category IN ('ads', 'promo', 'endorsement');
UPDATE public.expenses SET category = 'bb' WHERE category = 'bahan_baku';

-- 4. Mapping data lama petty_cash_expenses
UPDATE public.petty_cash_expenses SET category = 'bb' WHERE category = 'bahan_baku';
UPDATE public.petty_cash_expenses SET category = 'utilities' WHERE category = 'utilitas';
UPDATE public.petty_cash_expenses SET category = 'outlet' WHERE category IN ('operasional', 'lainnya');

-- 5. Update RPC add_petty_cash
CREATE OR REPLACE FUNCTION public.add_petty_cash(
  p_category TEXT,
  p_amount DECIMAL,
  p_description TEXT,
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS public.petty_cash_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet UUID;
  v_row public.petty_cash_expenses;
  v_current_balance DECIMAL;
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

  -- Kategori yang valid (sudah disesuaikan dengan OPEX)
  IF p_category NOT IN ('cash_in', 'admin', 'outlet', 'utilities', 'overtime', 'bb', 'ads') THEN
    RAISE EXCEPTION 'Kategori tidak valid: %', p_category;
  END IF;

  -- Validasi saldo petty cash
  v_current_balance := public.get_petty_cash_balance(v_outlet);
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo Petty Cash tidak mencukupi. Sisa saldo: %', v_current_balance;
  END IF;

  INSERT INTO public.petty_cash_expenses (
    outlet_id, category, amount, description, expense_date,
    payment_source, created_by, receipt_url, type
  )
  VALUES (
    v_outlet, p_category, p_amount, btrim(p_description), CURRENT_DATE,
    'petty_cash', auth.uid(), p_receipt_url, 'expense'
  )
  RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$;
