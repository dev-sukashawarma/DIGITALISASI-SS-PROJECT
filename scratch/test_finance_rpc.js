const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRPCDefinition() {
  const { data, error } = await supabase.rpc('finance_process_petty_cash', {
    p_topup_id: 'db7c9f17-0820-412e-89c7-2920b8c6b6eb',
    p_action: 'approve',
    p_method: 'transfer',
    p_cash_location_id: '0c116d5f-f147-4eff-9bc2-ce9d549e2869',
    p_proof_of_transfer_url: null
  });

  console.log('RPC result:', data, error);
}

checkRPCDefinition();
