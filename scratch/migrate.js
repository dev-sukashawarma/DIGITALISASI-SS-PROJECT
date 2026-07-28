const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
  ALTER TABLE petty_cash_expenses 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

  CREATE OR REPLACE FUNCTION void_petty_cash_expense(p_expense_id UUID, p_reason TEXT)
  RETURNS VOID AS $$
  DECLARE
    v_expense_record RECORD;
    v_shift_record RECORD;
    v_user_id UUID;
  BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the expense
    SELECT * INTO v_expense_record FROM petty_cash_expenses WHERE id = p_expense_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Expense not found';
    END IF;

    IF v_expense_record.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Expense is already voided';
    END IF;

    -- Check if there is an active open shift for this outlet
    SELECT * INTO v_shift_record FROM shifts WHERE outlet_id = v_expense_record.outlet_id AND status = 'open' LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot void expense because there is no open shift for this outlet';
    END IF;

    -- Update the expense
    UPDATE petty_cash_expenses 
    SET deleted_at = NOW(),
        deleted_by = v_user_id,
        delete_reason = p_reason
    WHERE id = p_expense_id;

  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });
  console.log('rpc err (sql):', error, data);
  if (error && error.message.includes('not found')) {
      const { data: d2, error: e2 } = await supabase.rpc('exec_sql', { query: sql });
      console.log('rpc err (query):', e2, d2);
  }
}
run();
