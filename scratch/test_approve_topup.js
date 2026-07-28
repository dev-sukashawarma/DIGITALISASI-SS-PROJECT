const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testApproveTopup() {
  const targetId = 'a303d96b-b6d4-4708-92f4-c653b6d22309';

  // Fetch topup first
  const { data: topup, error: fErr } = await supabase
    .from('petty_cash_topups')
    .select('*')
    .eq('id', targetId)
    .single();

  console.log('Topup before update:', fErr ? fErr : topup);

  // Try updating to approved_by_finance
  const { data: updated, error: uErr } = await supabase
    .from('petty_cash_topups')
    .update({
      status: 'approved_by_finance',
      finance_approved_by: '4f1d7a91-7ef8-49b1-977f-7074ca48ed6c',
      disbursement_method: 'transfer',
      disbursed_from_cash_location_id: '0c116d5f-f147-4eff-9bc2-ce9d549e2869',
      amount: 500000
    })
    .eq('id', targetId)
    .select();

  console.log('Update result:', uErr ? uErr : updated);

  // Also check foreign key constraint on finance_approved_by
  const { error: fkErr } = await supabase
    .from('petty_cash_topups')
    .update({
      finance_approved_by: '00000000-0000-0000-0000-000000000000'
    })
    .eq('id', targetId);

  console.log('FK Test with dummy UUID:', fkErr ? fkErr.message : 'Success');
}

testApproveTopup();
