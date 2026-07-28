const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPendingFinance() {
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .eq('status', 'forwarded_to_finance');

  if (error) console.error(error);
  else console.log('Forwarded to finance topups:', JSON.stringify(data, null, 2));
}

checkPendingFinance();
