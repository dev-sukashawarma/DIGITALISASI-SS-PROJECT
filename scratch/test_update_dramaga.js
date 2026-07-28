const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdateDramaga() {
  const { data: topup, error: fetchError } = await supabase
    .from('petty_cash_topups')
    .select('*')
    .eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb')
    .single();

  console.log('Topup before:', topup, fetchError);

  const { data: updateData, error: updateError } = await supabase
    .from('petty_cash_topups')
    .update({
      status: 'approved_by_finance',
      finance_approved_by: null,
      disbursement_method: 'transfer',
      disbursed_from_cash_location_id: '0c116d5f-f147-4eff-9bc2-ce9d549e2869',
      proof_of_transfer_url: null,
      amount: 400000,
      description: topup.description
    })
    .eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb')
    .select('*');

  console.log('Update result:', updateData, updateError);
}

testUpdateDramaga();
