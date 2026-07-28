const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anonClient = createClient(url, anonKey);

async function testRPCWithCustomAmountAndNote() {
  console.log('1. Reset topup...');
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await supabase.from('petty_cash_topups').update({
    status: 'forwarded_to_finance',
    finance_approved_by: null,
    amount: 400000,
    description: 'Buat beli token listrik karena mau habis'
  }).eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb');

  console.log('2. Call RPC finance_process_petty_cash with anon client...');
  const { error: rpcErr } = await anonClient.rpc('finance_process_petty_cash', {
    p_topup_id: 'db7c9f17-0820-412e-89c7-2920b8c6b6eb',
    p_action: 'approve',
    p_method: 'transfer',
    p_cash_location_id: null,
    p_proof_of_transfer_url: null
  });

  console.log('RPC error:', rpcErr);

  console.log('3. Check status in DB after RPC...');
  const { data: rowAfterRPC } = await supabase.from('petty_cash_topups').select('*').eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb').single();
  console.log('Row after RPC:', rowAfterRPC.status, rowAfterRPC.amount);
}

testRPCWithCustomAmountAndNote();
