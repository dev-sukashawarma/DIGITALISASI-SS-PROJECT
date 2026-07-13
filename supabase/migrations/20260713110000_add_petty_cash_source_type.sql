-- 20260713110000_add_petty_cash_source_type.sql
-- Add 'petty_cash_topup' to cash_transaction_source_type_check constraint

ALTER TABLE public.cash_transaction 
  DROP CONSTRAINT IF EXISTS cash_transaction_source_type_check;

ALTER TABLE public.cash_transaction
  ADD CONSTRAINT cash_transaction_source_type_check 
  CHECK (source_type IN ('payroll','supplier_po','expense_pusat','kasbon','cash_deposit','manual','transfer','petty_cash_topup'));
