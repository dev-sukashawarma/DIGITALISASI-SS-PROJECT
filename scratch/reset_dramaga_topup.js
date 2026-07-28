const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetTopup() {
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .update({
      status: 'forwarded_to_finance',
      finance_approved_by: null,
      approved_by: null,
      approved_at: null,
      disbursement_method: null,
      disbursed_from_cash_location_id: null,
      proof_of_transfer_url: null,
      amount: 400000,
      description: 'Buat beli token listrik karena mau habis'
    })
    .eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb')
    .select();

  console.log('Reset result:', data, error);
}

resetTopup();
