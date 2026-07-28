const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreTopupStatus() {
  const targetId = 'a303d96b-b6d4-4708-92f4-c653b6d22309';
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .update({
      status: 'forwarded_to_finance',
      finance_approved_by: null
    })
    .eq('id', targetId)
    .select();

  if (error) {
    console.error('Error updating status:', error);
  } else {
    console.log('Successfully restored status to forwarded_to_finance:', data[0]);
  }
}

restoreTopupStatus();
