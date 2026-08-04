-- Migration: Update existing leave_requests and cash_advances to support SPV & HR approval hierarchy
-- THIS MIGRATION IS REDUNDANT.
-- The tables were created as hr_leaves and hr_cash_advances in the previous migration,
-- and they already include status_spv, status_hr, installment_months, and correct RLS policies.
SELECT 1;
