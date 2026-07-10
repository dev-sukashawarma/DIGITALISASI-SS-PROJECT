-- 20260711100300_finance_rls_storage.sql
-- M5 Finance: RLS ketat (hanya finance) + bucket bukti transfer.

ALTER TABLE public.cash_location    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_balance     ENABLE ROW LEVEL SECURITY;

-- SELECT: hanya finance (admin_finance/owner/admin). Tulis via RPC DEFINER, jadi tak perlu policy INSERT/UPDATE utk user.
DROP POLICY IF EXISTS cash_location_read    ON public.cash_location;
DROP POLICY IF EXISTS cash_transaction_read ON public.cash_transaction;
DROP POLICY IF EXISTS cash_balance_read     ON public.cash_balance;

CREATE POLICY cash_location_read    ON public.cash_location    FOR SELECT USING (public.is_finance());
CREATE POLICY cash_transaction_read ON public.cash_transaction FOR SELECT USING (public.is_finance());
CREATE POLICY cash_balance_read     ON public.cash_balance     FOR SELECT USING (public.is_finance());

-- cash_location dikelola owner/admin (setup rekening) — izinkan tulis utk checker.
DROP POLICY IF EXISTS cash_location_write ON public.cash_location;
CREATE POLICY cash_location_write ON public.cash_location FOR ALL
  USING (public.is_finance_checker()) WITH CHECK (public.is_finance_checker());

-- Storage bucket bukti (private).
INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-proofs', 'finance-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS finance_proofs_rw ON storage.objects;
CREATE POLICY finance_proofs_rw ON storage.objects FOR ALL
  USING (bucket_id = 'finance-proofs' AND public.is_finance())
  WITH CHECK (bucket_id = 'finance-proofs' AND public.is_finance());

-- DOWN: DROP POLICY cash_location_read/cash_transaction_read/cash_balance_read/cash_location_write/finance_proofs_rw;
--       ALTER TABLE ... DISABLE ROW LEVEL SECURITY; DELETE FROM storage.buckets WHERE id='finance-proofs';
