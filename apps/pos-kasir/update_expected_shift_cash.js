require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE OR REPLACE FUNCTION public.get_expected_shift_cash(p_shift_id UUID)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift RECORD;
  v_cash_sales DECIMAL := 0;
  v_cash_expenses DECIMAL := 0;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;

  IF v_shift.outlet_id NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Not authorized to view this shift';
  END IF;

  -- Sum of cash orders completed in this time range
  -- FIX: Using updated_at instead of created_at so that orders created before 
  -- the shift but completed during the shift are correctly counted.
  SELECT COALESCE(SUM(total_amount), 0) INTO v_cash_sales
  FROM public.orders
  WHERE outlet_id = v_shift.outlet_id
    AND (payment_method = 'cash' OR channel IS NOT NULL)
    AND status = 'completed'
    AND updated_at >= v_shift.start_time
    AND updated_at <= COALESCE(v_shift.end_time, NOW());
    
  -- Sum of petty cash expenses tied to this shift
  SELECT COALESCE(SUM(amount), 0) INTO v_cash_expenses
  FROM public.expenses
  WHERE shift_id = p_shift_id
    AND payment_source = 'cash_drawer';
    
  RETURN v_shift.starting_cash + v_cash_sales - v_cash_expenses;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_expected_shift_cash(UUID) TO authenticated;
`;

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error updating function:', error);
  } else {
    console.log('Successfully updated get_expected_shift_cash function!');
  }
}

run();
