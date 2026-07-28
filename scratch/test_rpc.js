const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRpc() {
  const { data, error } = await supabase.rpc('finance_process_petty_cash', {
    p_topup_id: 'a303d96b-b6d4-4708-92f4-c653b6d22309',
    p_action: 'reject', // dry run test reject or test existence
  });
  console.log('RPC finance_process_petty_cash test:', error ? error : data);
}

checkRpc();
