-- 20260704064710_fix_upsert_expense_payment_source.sql
-- Memperbaiki fungsi upsert_expense agar default payment_source-nya adalah transfer_pusat
-- atau diisi secara eksplisit. Rekap pengeluaran owner (seperti Ads, Promo, dll) 
-- seharusnya bukan dari laci kasir (cash_drawer).

CREATE OR REPLACE FUNCTION public.upsert_expense(
  p_outlet UUID, p_category TEXT, p_period_month DATE, p_amount NUMERIC, p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_pusat BOOLEAN := p_category IN ('pengeluaran_global','gaji_staff_kantor');
BEGIN
  IF is_pusat THEN
    IF p_outlet IS NOT NULL THEN RAISE EXCEPTION 'Kategori pusat tak boleh punya outlet'; END IF;
    IF NOT public.is_owner() THEN RAISE EXCEPTION 'Hanya owner yang boleh input Pengeluaran Pusat'; END IF;
  ELSE
    IF p_outlet IS NULL THEN RAISE EXCEPTION 'Kategori outlet wajib punya outlet'; END IF;
    IF NOT public.is_owner_or_admin() THEN RAISE EXCEPTION 'Hanya owner/admin yang boleh input pengeluaran'; END IF;
  END IF;

  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, period_month, payment_source)
  VALUES (
    p_outlet, 
    p_category, 
    p_amount, 
    p_description, 
    date_trunc('month', p_period_month)::date, 
    date_trunc('month', p_period_month)::date,
    'transfer_pusat'
  )
  ON CONFLICT (outlet_id, category, period_month)
  DO UPDATE SET 
    amount = EXCLUDED.amount, 
    description = EXCLUDED.description,
    payment_source = EXCLUDED.payment_source;
END;
$$;
