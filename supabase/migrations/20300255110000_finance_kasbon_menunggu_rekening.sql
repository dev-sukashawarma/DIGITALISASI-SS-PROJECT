-- Tambah informasi rekening tujuan staf (dari staff_financials) ke RPC finance_kasbon_menunggu
-- agar Hub Approval & modal pencairan kasbon menampilkan nomor rekening yang akan dituju.

DROP FUNCTION IF EXISTS public.finance_kasbon_menunggu();

CREATE OR REPLACE FUNCTION public.finance_kasbon_menunggu()
RETURNS TABLE (
  id uuid, staff_id uuid, staff_nama text, outlet_nama text, amount numeric,
  amount_requested numeric, reason text, installment_months int, approval_note text,
  approved_at timestamptz, approved_by uuid, penyetuju_nama text, created_at timestamptz,
  bank_name text, bank_account_number text, bank_account_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.kasbon_pencair_ok() THEN
    RAISE EXCEPTION 'Hanya tim finance yang boleh memproses kasbon' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT k.id, k.staff_id, s.name::text, o.name::text, k.amount, k.amount_requested, k.reason,
         k.installment_months, k.approval_note, k.approved_at, k.approved_by, p.name::text, k.created_at,
         sf.bank_name::text, sf.bank_account_number::text, sf.bank_account_name::text
  FROM public.cash_advances k
  LEFT JOIN public.outlet_staff s     ON s.id = k.staff_id
  LEFT JOIN public.outlets o          ON o.id = s.outlet_id
  LEFT JOIN public.outlet_staff p     ON p.id = k.approved_by
  LEFT JOIN public.staff_financials sf ON sf.staff_id = k.staff_id
  WHERE k.status_hr = 'approved' AND k.status = 'menunggu_cair'
  ORDER BY coalesce(k.approved_at, k.created_at), k.id;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_kasbon_menunggu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_kasbon_menunggu() TO authenticated;
