-- 20260711110000_finance_payroll_disbursement.sql
-- M5 Finance P2: hubungkan payroll_records (slip gaji, dari admin-dashboard) ke
-- arus kas treasury. Aditif — hanya menambah kolom nullable/berdefault + RPC + trigger.
-- Tak mengubah kolom existing yang dipakai admin-dashboard.

-- Create missing table payroll_records if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.outlet_staff(id),
    period_month INT NOT NULL,
    period_year INT NOT NULL,
    total_salary NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Kolom status pembayaran di payroll_records (aditif, idempotent).
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS cash_transaction_id uuid REFERENCES public.cash_transaction(id);

-- CHECK payment_status (guarded agar re-run aman).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_records_payment_status_check'
  ) THEN
    ALTER TABLE public.payroll_records
      ADD CONSTRAINT payroll_records_payment_status_check
      CHECK (payment_status IN ('unpaid', 'pending', 'paid'));
  END IF;
END $$;

-- 2. RPC disburse_payroll: buat 1 cash_transaction (out) per slip FINAL & belum dibayar
--    pada periode, dari rekening bank pilihan. Slip → payment_status='pending' + link.
--    Uang riil ditransfer manual (Fase A); approval & rekonsiliasi lewat alur kas biasa.
CREATE OR REPLACE FUNCTION public.disburse_payroll(
  p_month int, p_year int, p_location uuid
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; tx uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;

  FOR r IN
    SELECT id, total_salary
    FROM public.payroll_records
    WHERE period_month = p_month AND period_year = p_year
      AND status = 'finalized'
      AND payment_status = 'unpaid'
      AND total_salary > 0
  LOOP
    INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
      source_type, source_id, note, status, created_by)
    VALUES (p_location, 'out', r.total_salary, format('Gaji %s/%s', p_month, p_year),
      'payroll', r.id, 'Disbursement gaji', 'pending_approval', auth.uid())
    RETURNING id INTO tx;

    UPDATE public.payroll_records
      SET payment_status = 'pending', cash_transaction_id = tx
      WHERE id = r.id;
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

-- 3. Trigger: sinkronkan payroll_records saat status cash_transaction (payroll) berubah.
--    reconciled/paid  → slip 'paid'  (+ paid_at)
--    rejected/void    → slip 'unpaid' (buka lagi utk dicairkan ulang, lepas link)
CREATE OR REPLACE FUNCTION public.sync_payroll_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_type <> 'payroll' OR NEW.source_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IN ('paid','reconciled') AND OLD.status NOT IN ('paid','reconciled') THEN
    UPDATE public.payroll_records
      SET payment_status = 'paid', paid_at = now()
      WHERE id = NEW.source_id;
  ELSIF NEW.status IN ('rejected','void') AND OLD.status NOT IN ('rejected','void') THEN
    UPDATE public.payroll_records
      SET payment_status = 'unpaid', cash_transaction_id = NULL, paid_at = NULL
      WHERE id = NEW.source_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payroll_payment ON public.cash_transaction;
CREATE TRIGGER trg_sync_payroll_payment
  AFTER UPDATE OF status ON public.cash_transaction
  FOR EACH ROW EXECUTE FUNCTION public.sync_payroll_payment();

-- DOWN:
-- DROP TRIGGER trg_sync_payroll_payment ON public.cash_transaction;
-- DROP FUNCTION sync_payroll_payment(); DROP FUNCTION disburse_payroll(int,int,uuid);
-- ALTER TABLE payroll_records DROP CONSTRAINT payroll_records_payment_status_check,
--   DROP COLUMN payment_status, DROP COLUMN paid_at, DROP COLUMN cash_transaction_id;
