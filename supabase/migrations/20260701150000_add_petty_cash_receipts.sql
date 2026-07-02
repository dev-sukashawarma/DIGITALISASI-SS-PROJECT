-- 20260701150000_add_petty_cash_receipts.sql

-- 1. Add receipt_url to expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2. Create storage bucket for petty-cash-receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'petty-cash-receipts', 
  'petty-cash-receipts', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
DROP POLICY IF EXISTS "Public can view petty cash receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;

CREATE POLICY "Public can view petty cash receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'petty-cash-receipts');

CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'petty-cash-receipts' AND auth.role() = 'authenticated');

-- 4. Update RPC add_petty_cash to accept p_receipt_url
CREATE OR REPLACE FUNCTION public.add_petty_cash(
  p_category TEXT,
  p_amount DECIMAL,
  p_description TEXT,
  p_receipt_url TEXT DEFAULT NULL
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
    payment_source, created_by, receipt_url
  )
  VALUES (
    v_outlet, p_category, p_amount, btrim(p_description), CURRENT_DATE,
    'cash_drawer', auth.uid(), p_receipt_url
  )
  RETURNING * INTO v_row;  -- trigger trg_link_expense_to_shift mengisi shift_id

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_petty_cash(TEXT, DECIMAL, TEXT, TEXT) TO authenticated;
