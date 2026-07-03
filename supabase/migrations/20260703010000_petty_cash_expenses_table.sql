-- 20260703010000_petty_cash_expenses_table.sql
-- Memisahkan petty cash dari tabel expenses (yang kini berfungsi sebagai rekap bulanan).

-- 1. Create petty_cash_expenses table
CREATE TABLE IF NOT EXISTS public.petty_cash_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bahan_baku', 'operasional', 'utilitas', 'lainnya')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_source TEXT NOT NULL DEFAULT 'petty_cash',
  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Setup RLS
ALTER TABLE public.petty_cash_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "petty_cash_expenses_select" ON public.petty_cash_expenses 
FOR SELECT TO authenticated 
USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

CREATE POLICY "petty_cash_expenses_insert" ON public.petty_cash_expenses 
FOR INSERT TO authenticated 
WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

GRANT SELECT, INSERT ON public.petty_cash_expenses TO authenticated;

-- 3. Update get_petty_cash_balance
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_outlet_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topups DECIMAL;
  v_expenses DECIMAL;
BEGIN
  IF p_outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this outlet';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_topups
  FROM public.petty_cash_topups
  WHERE outlet_id = p_outlet_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.petty_cash_expenses
  WHERE outlet_id = p_outlet_id;

  RETURN v_topups - v_expenses;
END;
$$;

-- 4. Update add_petty_cash to insert into petty_cash_expenses
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

  IF p_category NOT IN ('bahan_baku', 'operasional', 'utilitas', 'lainnya') THEN
    RAISE EXCEPTION 'Kategori tidak valid';
  END IF;

  -- Validasi saldo petty cash
  v_current_balance := public.get_petty_cash_balance(v_outlet);
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo Petty Cash tidak mencukupi. Sisa saldo: %', v_current_balance;
  END IF;

  INSERT INTO public.petty_cash_expenses (
    outlet_id, category, amount, description, expense_date,
    payment_source, created_by, receipt_url
  )
  VALUES (
    v_outlet, p_category, p_amount, btrim(p_description), CURRENT_DATE,
    'petty_cash', auth.uid(), p_receipt_url
  )
  RETURNING * INTO v_row;
  
  RETURN v_row;
END;
$$;
