const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const anonClient = createClient(url, anonKey);

async function testAnonRPC() {
  console.log('Testing finance_process_petty_cash via RPC with anon client...');

  const { data, error } = await anonClient.rpc('finance_process_petty_cash', {
    p_topup_id: 'db7c9f17-0820-412e-89c7-2920b8c6b6eb',
    p_action: 'approve',
    p_method: 'transfer',
    p_cash_location_id: null,
    p_proof_of_transfer_url: null
  });

  console.log('Anon RPC result:', data, error);
}

testAnonRPC();
