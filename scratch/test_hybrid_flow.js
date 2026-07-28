const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(url, anonKey);
const serviceClient = createClient(url, serviceKey);

async function testHybridFlow() {
  console.log('--- Hybrid Flow Test ---');
  // Reset
  await serviceClient.from('petty_cash_topups').update({
    status: 'forwarded_to_finance',
    finance_approved_by: null,
    amount: 400000,
    description: 'Buat beli token listrik karena mau habis'
  }).eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb');

  // Step 1: Call RPC
  const { error: rpcError } = await anonClient.rpc('finance_process_petty_cash', {
    p_topup_id: 'db7c9f17-0820-412e-89c7-2920b8c6b6eb',
    p_action: 'approve',
    p_method: 'transfer',
    p_cash_location_id: null,
    p_proof_of_transfer_url: null
  });

  console.log('Step 1 RPC error:', rpcError);

  // Step 2: Custom amount / note update
  const approvedAmount = 350000;
  const approvalNote = 'Disetujui 350rb saja';
  const newDescription = `Buat beli token listrik karena mau habis\n\n📌 [Catatan Finance (Acc Rp 350.000 dari Diajukan Rp 400.000): ${approvalNote}]`;

  const { data: updateData, error: updateError } = await serviceClient
    .from('petty_cash_topups')
    .update({
      amount: approvedAmount,
      description: newDescription
    })
    .eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb')
    .select();

  console.log('Step 2 Update result:', updateData, updateError);
}

testHybridFlow();
