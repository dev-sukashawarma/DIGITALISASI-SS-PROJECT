-- supabase/migrations/20260702000000_security_hardening.sql

-- 1. Voiding Authorization (orders table)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.outlet_staff(id),
ADD COLUMN IF NOT EXISTS void_reason TEXT,
ADD COLUMN IF NOT EXISTS void_at TIMESTAMPTZ;

-- 2. Expense Receipt Validation (expenses table)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Enforce receipt_url if payment_source is cash_drawer
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_cash_drawer_receipt_check
CHECK (payment_source != 'cash_drawer' OR receipt_url IS NOT NULL) NOT VALID;

-- 3. Surat Jalan Strict Validation (surat_jalan_item table)
-- Prevent surat_jalan from being received if any items are missing qty_terima

CREATE OR REPLACE FUNCTION public.check_surat_jalan_qty_terima()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('diterima_sebagian', 'diterima_lengkap') THEN
    IF EXISTS (
      SELECT 1 FROM public.surat_jalan_item 
      WHERE surat_jalan_id = NEW.id AND qty_terima IS NULL
    ) THEN
      RAISE EXCEPTION 'qty_terima must be filled for all items when receiving a surat_jalan';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_surat_jalan_qty_terima ON public.surat_jalan;
CREATE TRIGGER trg_check_surat_jalan_qty_terima
BEFORE UPDATE ON public.surat_jalan
FOR EACH ROW
EXECUTE FUNCTION public.check_surat_jalan_qty_terima();
