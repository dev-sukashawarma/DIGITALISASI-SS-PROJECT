-- Pengeluaran Buku Kas (OPEX) boleh dibayar dari rekening pusat aktif mana pun
-- (keputusan owner 6 Nov 2026), bukan hanya Rekening Petty Cash.
-- Badan = 20261105130000; hanya penjaga grup yang diganti. Rekening lama (grup NULL)
-- dan rekening nonaktif tetap ditolak.
CREATE OR REPLACE FUNCTION public.expenses_cek_sumber_kas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_grup text; v_aktif boolean;
BEGIN
  IF NEW.cash_location_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.cash_location_id IS NOT DISTINCT FROM OLD.cash_location_id
     AND NEW.amount IS NOT DISTINCT FROM OLD.amount
     AND NEW.expense_date IS NOT DISTINCT FROM OLD.expense_date
     AND NEW.type IS NOT DISTINCT FROM OLD.type THEN
    RETURN NEW;  -- tidak menyentuh sisi kas
  END IF;

  IF auth.uid() IS NOT NULL AND NOT (
       kas_pencatat_ok()
       OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')
     ) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat pengeluaran dari rekening pusat'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(NEW.type, 'expense') <> 'expense' THEN
    RAISE EXCEPTION 'Rekening pembayar hanya untuk pengeluaran (type expense), bukan %', NEW.type
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT grup, is_active INTO v_grup, v_aktif FROM cash_location WHERE id = NEW.cash_location_id;
  IF NOT FOUND OR v_aktif IS NOT TRUE THEN
    RAISE EXCEPTION 'Rekening pembayar tidak ditemukan atau sudah nonaktif'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_grup IS NULL THEN
    RAISE EXCEPTION 'Pengeluaran hanya boleh dibayar dari rekening pusat'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran dari rekening pusat harus lebih dari 0'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
