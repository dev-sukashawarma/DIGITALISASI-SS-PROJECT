const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAfterRPC() {
  const { data } = await supabase.from('petty_cash_topups').select('*').eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb').single();
  console.log('Topup after anon RPC:', data);
}

checkAfterRPC();
